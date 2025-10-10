const WebSocket = require('ws');
const { v4: uuid } = require('uuid');
const { config, logger, logClient, logGeminiAI } = require('../config');
const { sipMap, cleanupPromises } = require('../state');
const { streamAudio, rtpEvents } = require('../rtp');
const { pcm24kToUlaw } = require('./audio');

logger.info('Loading gemini.js module');

async function waitForBufferEmpty(channelId, maxWaitTime = 6000, checkInterval = 10) {
  const channelData = sipMap.get(channelId);
  if (!channelData?.streamHandler) {
    logGeminiAI(`No streamHandler for ${channelId}, proceeding`, 'info');
    return true;
  }
  const streamHandler = channelData.streamHandler;
  const startWaitTime = Date.now();

  let audioDurationMs = 1000; // Default minimum
  if (channelData.totalDeltaBytes) {
    audioDurationMs = Math.ceil((channelData.totalDeltaBytes / 8000) * 1000) + 500; // Audio duration + 500ms margin
  }
  const dynamicTimeout = Math.min(audioDurationMs, maxWaitTime);
  logGeminiAI(`Using dynamic timeout of ${dynamicTimeout}ms for ${channelId} (estimated audio duration: ${(channelData.totalDeltaBytes || 0) / 8000}s)`, 'info');

  let audioFinishedReceived = false;
  const audioFinishedPromise = new Promise((resolve) => {
    rtpEvents.once('audioFinished', (id) => {
      if (id === channelId) {
        logGeminiAI(`Audio finished sending for ${channelId} after ${Date.now() - startWaitTime}ms`, 'info');
        audioFinishedReceived = true;
        resolve();
      }
    });
  });

  const isBufferEmpty = () => (
    (!streamHandler.audioBuffer || streamHandler.audioBuffer.length === 0) &&
    (!streamHandler.packetQueue || streamHandler.packetQueue.length === 0)
  );
  if (!isBufferEmpty()) {
    let lastLogTime = 0;
    while (!isBufferEmpty() && (Date.now() - startWaitTime) < maxWaitTime) {
      const now = Date.now();
      if (now - lastLogTime >= 50) {
        logGeminiAI(`Waiting for RTP buffer to empty for ${channelId} | Buffer: ${streamHandler.audioBuffer?.length || 0} bytes, Queue: ${streamHandler.packetQueue?.length || 0} packets`, 'info');
        lastLogTime = now;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    if (!isBufferEmpty()) {
      logger.warn(`Timeout waiting for RTP buffer to empty for ${channelId} after ${maxWaitTime}ms`);
      return false;
    }
    logGeminiAI(`RTP buffer emptied for ${channelId} after ${Date.now() - startWaitTime}ms`, 'info');
  }

  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      if (!audioFinishedReceived) {
        logger.warn(`Timeout waiting for audioFinished for ${channelId} after ${dynamicTimeout}ms`);
      }
      resolve();
    }, dynamicTimeout);
  });
  await Promise.race([audioFinishedPromise, timeoutPromise]);

  logGeminiAI(`waitForBufferEmpty completed for ${channelId} in ${Date.now() - startWaitTime}ms`, 'info');
  return true;
}

async function startGeminiWebSocket(channelId) {
  const GEMINI_API_KEY = config.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    logger.error('GEMINI_API_KEY is missing in config');
    throw new Error('Missing GEMINI_API_KEY');
  }

  let channelData = sipMap.get(channelId);
  if (!channelData) {
    throw new Error(`Channel ${channelId} not found in sipMap`);
  }

  let ws;
  let streamHandler = null;
  let retryCount = 0;
  const maxRetries = 3;
  let isResponseActive = false;
  let totalDeltaBytes = 0;
  let loggedDeltaBytes = 0;
  let segmentCount = 0;
  let messageQueue = [];

  const processMessage = async (response) => {
    try {
      // Handle setupComplete message
      if (response.setupComplete !== undefined) {
        logClient(`Session setup complete for ${channelId}`);
        return;
      }

      // Handle serverContent messages
      if (response.serverContent) {
        const content = response.serverContent;
        
        // Handle interruption
        if (content.interrupted) {
          logGeminiAI(`Response interrupted for ${channelId}`, 'info');
          if (streamHandler) {
            streamHandler.stopPlayback();
          }
        }

        // Handle model turn with audio data
        if (content.modelTurn && content.modelTurn.parts) {
          for (const part of content.modelTurn.parts) {
            // Handle inline audio data
            if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('audio/pcm')) {
              const pcm24kBuffer = Buffer.from(part.inlineData.data, 'base64');
              logger.debug(`Received PCM audio for ${channelId}: ${pcm24kBuffer.length} bytes, mimeType: ${part.inlineData.mimeType}`);
              
              if (pcm24kBuffer.length > 0) {
                // Convert 24kHz PCM to 8kHz μ-law
                const ulawBuffer = pcm24kToUlaw(pcm24kBuffer);
                logger.debug(`Converted to μ-law for ${channelId}: ${ulawBuffer.length} bytes`);
                
                totalDeltaBytes += ulawBuffer.length;
                channelData.totalDeltaBytes = totalDeltaBytes;
                sipMap.set(channelId, channelData);
                segmentCount++;
                
                if (totalDeltaBytes - loggedDeltaBytes >= 4000 || segmentCount >= 100) {
                  logGeminiAI(`Received audio delta for ${channelId}: ${ulawBuffer.length} bytes, total: ${totalDeltaBytes} bytes, estimated duration: ${(totalDeltaBytes / 8000).toFixed(2)}s`, 'info');
                  loggedDeltaBytes = totalDeltaBytes;
                  segmentCount = 0;
                }

                let packetBuffer = ulawBuffer;
                if (totalDeltaBytes === ulawBuffer.length) {
                  const silenceDurationMs = config.SILENCE_PADDING_MS || 100;
                  const silencePackets = Math.ceil(silenceDurationMs / 20);
                  const silenceBuffer = Buffer.alloc(silencePackets * 160, 0x7F);
                  packetBuffer = Buffer.concat([silenceBuffer, ulawBuffer]);
                  logger.info(`Prepended ${silencePackets} silence packets (${silenceDurationMs} ms) for ${channelId}`);
                }

                if (sipMap.has(channelId) && streamHandler) {
                  streamHandler.sendRtpPacket(packetBuffer);
                }
              } else {
                logger.warn(`Received empty audio buffer for ${channelId}`);
              }
            }

            // Handle text content for transcription
            if (part.text) {
              logger.debug(`Assistant text for ${channelId}: ${part.text}`);
            }
          }
        }

        // Handle input transcription
        if (content.inputTranscription) {
          const transcriptText = typeof content.inputTranscription === 'string' 
            ? content.inputTranscription 
            : content.inputTranscription.text || JSON.stringify(content.inputTranscription);
          logGeminiAI(`User command transcription for ${channelId}: ${transcriptText}`, 'info');
        }

        // Handle output transcription
        if (content.outputTranscription) {
          const transcriptText = typeof content.outputTranscription === 'string' 
            ? content.outputTranscription 
            : content.outputTranscription.text || JSON.stringify(content.outputTranscription);
          logGeminiAI(`Assistant transcription for ${channelId}: ${transcriptText}`, 'info');
        }

        // Handle turn completion
        if (content.turnComplete) {
          logGeminiAI(`Response turn complete for ${channelId}, total delta bytes: ${totalDeltaBytes}, estimated duration: ${(totalDeltaBytes / 8000).toFixed(2)}s`, 'info');
          isResponseActive = false;
          loggedDeltaBytes = 0;
          segmentCount = 0;
        }

        // Handle generation completion
        if (content.generationComplete) {
          logGeminiAI(`Generation complete for ${channelId}`, 'info');
        }
      }

      // Handle tool call messages
      if (response.toolCall) {
        logger.debug(`Tool call received for ${channelId}: ${JSON.stringify(response.toolCall)}`);
      }

      // Handle tool call cancellation
      if (response.toolCallCancellation) {
        logger.debug(`Tool call cancellation for ${channelId}: ${JSON.stringify(response.toolCallCancellation)}`);
      }

      // Handle usage metadata
      if (response.usageMetadata) {
        logger.debug(`Usage metadata for ${channelId}: ${JSON.stringify(response.usageMetadata)}`);
      }

    } catch (e) {
      logger.error(`Error processing message for ${channelId}: ${e.message}`);
    }
  };

  const connectWebSocket = () => {
    return new Promise((resolve, reject) => {
      // Gemini Live API WebSocket URL with API key
      const geminiUrl = `${config.GEMINI_REALTIME_URL}?key=${GEMINI_API_KEY}`;
      
      ws = new WebSocket(geminiUrl);

      ws.on('open', async () => {
        logClient(`Gemini WebSocket connected for ${channelId}`);
        
        // Send setup message (Gemini Live API format)
        const setupMessage = {
          setup: {
            model: config.GEMINI_MODEL || 'models/gemini-2.0-flash-exp',
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: config.GEMINI_VOICE || 'Puck'
                  }
                }
              }
            }
          }
        };

        // Add system instruction if configured
        if (config.SYSTEM_PROMPT) {
          setupMessage.setup.systemInstruction = {
            parts: [{ text: config.SYSTEM_PROMPT }]
          };
        }

        // Add realtime input config for audio
        setupMessage.setup.realtimeInputConfig = {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: config.START_SENSITIVITY || 'START_SENSITIVITY_HIGH',
            prefixPaddingMs: config.VAD_PREFIX_PADDING_MS || 200,
            endOfSpeechSensitivity: config.END_SENSITIVITY || 'END_SENSITIVITY_HIGH',
            silenceDurationMs: config.VAD_SILENCE_DURATION_MS || 600
          },
          activityHandling: 'START_OF_ACTIVITY_INTERRUPTS'
        };

        // Add audio transcription config
        setupMessage.setup.inputAudioTranscription = {};
        setupMessage.setup.outputAudioTranscription = {};

        ws.send(JSON.stringify(setupMessage));
        logClient(`Setup message sent for ${channelId}`);

        try {
          const rtpSource = channelData.rtpSource || { address: '127.0.0.1', port: 12000 };
          streamHandler = await streamAudio(channelId, rtpSource);
          channelData.ws = ws;
          channelData.streamHandler = streamHandler;
          channelData.totalDeltaBytes = 0;
          sipMap.set(channelId, channelData);

          // Send initial message using clientContent
          if (config.INITIAL_MESSAGE) {
            logClient(`Sending initial message for ${channelId}: ${config.INITIAL_MESSAGE}`);
            ws.send(JSON.stringify({
              clientContent: {
                turns: [{
                  role: 'user',
                  parts: [{ text: config.INITIAL_MESSAGE }]
                }],
                turnComplete: true
              }
            }));
          }
          
          isResponseActive = true;
          resolve(ws);
        } catch (e) {
          logger.error(`Error setting up WebSocket for ${channelId}: ${e.message}`);
          reject(e);
        }
      });

      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          logger.debug(`Raw WebSocket message for ${channelId}: ${JSON.stringify(response, null, 2)}`);
          messageQueue.push(response);
        } catch (e) {
          logger.error(`Error parsing WebSocket message for ${channelId}: ${e.message}`);
        }
      });

      ws.on('error', (e) => {
        logger.error(`WebSocket error for ${channelId}: ${e.message}`);
        if (retryCount < maxRetries && sipMap.has(channelId)) {
          retryCount++;
          setTimeout(() => connectWebSocket().then(resolve).catch(reject), 1000);
        } else {
          reject(new Error(`Failed WebSocket after ${maxRetries} attempts`));
        }
      });

      const handleClose = () => {
        logger.info(`WebSocket closed for ${channelId}`);
        channelData.wsClosed = true;
        channelData.ws = null;
        sipMap.set(channelId, channelData);
        ws.off('close', handleClose);
        const cleanupResolve = cleanupPromises.get(`ws_${channelId}`);
        if (cleanupResolve) {
          cleanupResolve();
          cleanupPromises.delete(`ws_${channelId}`);
        }
      };
      ws.on('close', handleClose);
    });
  };

  setInterval(async () => {
    const maxMessages = 5;
    for (let i = 0; i < maxMessages && messageQueue.length > 0; i++) {
      await processMessage(messageQueue.shift());
    }
  }, 25);

  try {
    await connectWebSocket();
  } catch (e) {
    logger.error(`Failed to start WebSocket for ${channelId}: ${e.message}`);
    throw e;
  }
}

module.exports = { startGeminiWebSocket };