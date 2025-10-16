const WebSocket = require('ws');
const { v4: uuid } = require('uuid');
const { config, logger, logClient, logAI } = require('./config');
const { sipMap, cleanupPromises } = require('./state');
const { streamAudio, rtpEvents } = require('./rtp');
const { AgentSetting } = require('./agent-setting');

logger.info('Loading external-ai.js module');

/**
 * Wait for RTP buffer to empty before proceeding
 * This ensures all audio has been sent to Asterisk before continuing
 */
async function waitForBufferEmpty(channelId, maxWaitTime = 6000, checkInterval = 10) {
  const channelData = sipMap.get(channelId);
  if (!channelData?.streamHandler) {
    logAI(`No streamHandler for ${channelId}, proceeding`, 'info');
    return true;
  }
  const streamHandler = channelData.streamHandler;
  const startWaitTime = Date.now();

  let audioDurationMs = 1000; // Default minimum
  if (channelData.totalDeltaBytes) {
    audioDurationMs = Math.ceil((channelData.totalDeltaBytes / 8000) * 1000) + 500;
    logAI(`Using dynamic timeout of ${audioDurationMs}ms for ${channelId}`, 'info');
  }
  const dynamicTimeout = Math.min(audioDurationMs, maxWaitTime);

  let audioFinishedReceived = false;
  const audioFinishedPromise = new Promise((resolve) => {
    rtpEvents.once('audioFinished', (id) => {
      if (id === channelId) {
        logAI(`Audio finished sending for ${channelId} after ${Date.now() - startWaitTime}ms`, 'info');
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
        logAI(`Waiting for RTP buffer to empty for ${channelId}`, 'info');
        lastLogTime = now;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    if (!isBufferEmpty()) {
      logger.warn(`Timeout waiting for RTP buffer to empty for ${channelId}`);
      return false;
    }
  }

  await Promise.race([audioFinishedPromise, 
    new Promise(resolve => setTimeout(resolve, dynamicTimeout))
  ]);

  logAI(`waitForBufferEmpty completed for ${channelId} in ${Date.now() - startWaitTime}ms`, 'info');
  return true;
}

/**
 * Start WebSocket connection to external AI model
 * Handles bidirectional audio streaming and conversation management
 */
async function startExternalAIWebSocket(channelId) {
  const AI_WEBSOCKET_URL = config.AI_WEBSOCKET_URL;
  if (!AI_WEBSOCKET_URL) {
    logger.error('AI_WEBSOCKET_URL is missing in config');
    throw new Error('Missing AI_WEBSOCKET_URL');
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

  /**
   * Process incoming messages from the AI server
   * Customize this based on your external AI's message format
   */
  const processMessage = async (message) => {
    try {
      // Parse the message based on your AI server's protocol
      let response;
      try {
        response = typeof message === 'string' ? JSON.parse(message) : message;
      } catch (e) {
        logger.error(`Failed to parse message for ${channelId}: ${e.message}`);
        return;
      }

      // Handle different message types from your AI server
      switch (response.type) {
        case 'session_started':
        case 'ready':
          logClient(`AI session ready for ${channelId}`);
          break;

        case 'session_updated':
          logAI(`Session updated for ${channelId}`);
          break;

        case 'audio_delta':
        case 'audio_chunk':
          // Handle incoming audio from AI
          if (response.audio || response.data) {
            const audioData = response.audio || response.data;
            const deltaBuffer = Buffer.from(audioData, 'base64');
            
            if (deltaBuffer.length > 0 && !deltaBuffer.every(byte => byte === 0x7F)) {
              totalDeltaBytes += deltaBuffer.length;
              channelData.totalDeltaBytes = totalDeltaBytes;
              sipMap.set(channelId, channelData);
              segmentCount++;

              // Log audio reception periodically
              if (totalDeltaBytes - loggedDeltaBytes >= 40000 || segmentCount >= 100) {
                logAI(`Received audio for ${channelId}: ${deltaBuffer.length} bytes, ` +
                      `total: ${totalDeltaBytes} bytes, duration: ${(totalDeltaBytes / 8000).toFixed(2)}s`, 'info');
                loggedDeltaBytes = totalDeltaBytes;
                segmentCount = 0;
              }

              // Add silence padding for first packet
              let packetBuffer = deltaBuffer;
              if (totalDeltaBytes === deltaBuffer.length) {
                const silenceDurationMs = config.SILENCE_PADDING_MS || 100;
                const silencePackets = Math.ceil(silenceDurationMs / 20);
                const silenceBuffer = Buffer.alloc(silencePackets * 160, 0x7F);
                packetBuffer = Buffer.concat([silenceBuffer, deltaBuffer]);
                logger.info(`Prepended ${silencePackets} silence packets for ${channelId}`);
              }

              // Send audio to Asterisk via RTP
              if (sipMap.has(channelId) && streamHandler) {
                streamHandler.sendRtpPacket(packetBuffer);
              }
            }
          }
          break;

        case 'transcript':
        case 'transcription':
          // Handle transcription from AI
          if (response.text) {
            const role = response.role || response.speaker || 'AI';
            logAI(`${role} transcription for ${channelId}: ${response.text}`, 'info');
          }
          break;

        case 'user_speech_started':
        case 'speech_started':
          // User started speaking - stop current playback
          logAI(`User voice detected for ${channelId}, stopping playback`);
          if (streamHandler) {
            streamHandler.stopPlayback();
          }
          break;

        case 'response_complete':
        case 'audio_done':
          logAI(`Response complete for ${channelId}, total bytes: ${totalDeltaBytes}`, 'info');
          isResponseActive = false;
          loggedDeltaBytes = 0;
          segmentCount = 0;
          break;

        case 'error':
          logger.error(`AI error for ${channelId}: ${response.message || response.error}`);
          if (response.fatal) {
            ws.close();
          }
          break;

        default:
          logger.debug(`Unhandled message type: ${response.type} for ${channelId}`);
          break;
      }
    } catch (e) {
      logger.error(`Error processing message for ${channelId}: ${e.message}`);
    }
  };

  /**
   * Establish WebSocket connection to external AI server
   */
  const connectWebSocket = () => {
    return new Promise((resolve, reject) => {
      // Create WebSocket connection with optional authentication
      const wsOptions = {};
      if (config.AI_AUTH_TOKEN) {
        wsOptions.headers = {
          'Authorization': `Bearer ${config.AI_AUTH_TOKEN}`,
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'Asterisk-AI-Client'
        };
      } else {
        wsOptions.headers = {
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'Asterisk-AI-Client'
        };
      }

      ws = new WebSocket(AI_WEBSOCKET_URL, wsOptions);

      ws.on('open', async () => {
        logClient(`External AI WebSocket connected for ${channelId}`);
        
        // Fetch updated channel data
        channelData = sipMap.get(channelId);
        const fromNumber = channelData.fromNumber || 'unknown';
        const toNumber = channelData.toNumber || 'unknown';
        logger.info(`Sending call context for ${channelId}: From ${fromNumber} to ${toNumber}`);

        // Fetch agent settings based on toNumber
        const getAgentSettings = new AgentSetting(toNumber);
        await getAgentSettings._fetchAgentSettings();

        // Check account balance before proceeding
        const agent_accountBalance = getAgentSettings.accountBalance;
        if (agent_accountBalance <= 0) {
          logger.warn(`Insufficient account balance (${agent_accountBalance}) for ${channelId}. Disconnecting call.`);
          ws.close();
          
          // Hangup the call
          try {
            const ariClient = require('./asterisk').ariClient;
            await ariClient.channels.hangup({ channelId: channelId });
            logger.info(`Call ${channelId} hung up due to insufficient balance`);
          } catch (e) {
            logger.error(`Error hanging up call ${channelId}: ${e.message}`);
          }
          return;
        }
        
        logger.info(`Account balance check passed for ${channelId}: Balance = ${agent_accountBalance}`);

        // Attach agent settings to channel data
        const agent_prompt = getAgentSettings.prompt;
        const agent_voice = getAgentSettings.voice;
        const agent_temperature = getAgentSettings.temperature;
        const agent_maxTokens = getAgentSettings.maxTokens;
        const agent_name = getAgentSettings.name;
        const agent_userId = getAgentSettings.userId;
        const agent_orgUid = getAgentSettings.orgUid;
        const agent_id = getAgentSettings.agentId;
        const agent_generateResponseModel = getAgentSettings.generateResponseModel;
        const agent_costOfCall = getAgentSettings.costOfCall;
        // Send initial session configuration to AI server
        // Customize this based on your AI server's protocol
        const sessionConfig = {
          type: 'session.init',
          config: {
            audio_format: 'g711_ulaw',  // Or 'pcm16' depending on your AI
            sample_rate: 8000,
            channels: 1,
            voice: agent_voice,
            system_prompt: agent_prompt,
            temperature: agent_temperature,
            max_tokens: agent_maxTokens,
            user_id: agent_userId,
            agent_name: agent_name,
            org_uid: agent_orgUid,
            agent_id: agent_id,
            account_balance: agent_accountBalance,
            response_model: agent_generateResponseModel,
            cost_of_call_per_minute: agent_costOfCall || 0.27,
            session_id: uuid(),
            // Add call context here
            call_context: {
              from_number: fromNumber,
              to_number: toNumber
            },
          }
        };

        ws.send(JSON.stringify(sessionConfig));
        logClient(`Session configuration sent for ${channelId}`);

        try {
          // Set up RTP audio streaming
          const rtpSource = channelData.rtpSource || { address: '127.0.0.1', port: 12000 };
          streamHandler = await streamAudio(channelId, rtpSource);
          
          channelData.ws = ws;
          channelData.streamHandler = streamHandler;
          channelData.totalDeltaBytes = 0;
          sipMap.set(channelId, channelData);

          // Send initial greeting message if configured
          if (config.INITIAL_MESSAGE) {
            logClient(`Sending initial message for ${channelId}: ${config.INITIAL_MESSAGE}`);
            ws.send(JSON.stringify({
              type: 'text.input',
              text: config.INITIAL_MESSAGE
            }));
          }

          resolve(ws);
        } catch (e) {
          logger.error(`Error setting up WebSocket for ${channelId}: ${e.message}`);
          reject(e);
        }
      });

      ws.on('message', (data) => {
        try {
          // Queue messages for processing
          messageQueue.push(data.toString());
        } catch (e) {
          logger.error(`Error queueing message for ${channelId}: ${e.message}`);
        }
      });

      ws.on('error', (e) => {
        logger.error(`WebSocket error for ${channelId}: ${e.message}`);
        if (retryCount < maxRetries && sipMap.has(channelId)) {
          retryCount++;
          logger.info(`Retrying connection (${retryCount}/${maxRetries}) for ${channelId}`);
          setTimeout(() => connectWebSocket().then(resolve).catch(reject), 1000);
        } else {
          reject(new Error(`Failed WebSocket after ${maxRetries} attempts`));
        }
      });

      const handleClose = (code, reason) => {
        logger.info(`WebSocket closed for ${channelId} (code: ${code}, reason: ${reason})`);
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

  // Process message queue periodically
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

/**
 * Send audio data from Asterisk to the AI server
 * This is called when audio is received from the RTP receiver
 */
function sendAudioToAI(channelId, audioBuffer) {
  const channelData = sipMap.get(channelId);
  if (!channelData || !channelData.ws || channelData.ws.readyState !== 1) {
    return false;
  }

  const fromNumber = channelData.fromNumber || 'unknown';
  const toNumber = channelData.toNumber || 'unknown';

  try {
    // Send audio to AI server
    // Customize the message format based on your AI server's protocol
    channelData.ws.send(JSON.stringify({
      type: 'audio.input',
      audio: audioBuffer.toString('base64'),
      format: 'g711_ulaw',
      call_context: {
        from_number: fromNumber,
        to_number: toNumber
      }
    }));
    return true;
  } catch (e) {
    logger.error(`Error sending audio to AI for ${channelId}: ${e.message}`);
    return false;
  }
}

module.exports = { 
  startExternalAIWebSocket,
  sendAudioToAI
};