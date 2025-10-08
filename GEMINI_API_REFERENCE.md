# Gemini Live API Quick Reference

## WebSocket Endpoint
```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=YOUR_API_KEY
```

## Available Models
- `models/gemini-2.0-flash-exp` (Default, recommended)
- `models/gemini-1.5-pro`
- `models/gemini-1.5-flash`

## Available Voices
- **Puck** (Default) - Friendly, conversational
- **Charon** - Deep, authoritative
- **Kore** - Warm, professional
- **Fenrir** - Dynamic, energetic
- **Aoede** - Calm, soothing

## Sensitivity Settings

### Start of Speech Sensitivity
- `START_SENSITIVITY_HIGH` (Default) - Detects speech more quickly
- `START_SENSITIVITY_LOW` - Requires clearer speech signal

### End of Speech Sensitivity
- `END_SENSITIVITY_HIGH` (Default) - Ends speech detection quickly
- `END_SENSITIVITY_LOW` - Waits longer before ending speech

## Audio Format
- **Sample Rate:** 8000 Hz
- **Encoding:** μ-law (G.711)
- **Channels:** Mono
- **Transport:** Base64-encoded in JSON messages

## Message Types

### Setup (Initial Configuration)
```json
{
  "setup": {
    "model": "models/gemini-2.0-flash-exp",
    "generationConfig": {
      "responseModalities": ["audio"],
      "speechConfig": {
        "voiceConfig": {
          "prebuiltVoiceConfig": {
            "voiceName": "Puck"
          }
        }
      }
    },
    "systemInstruction": {
      "parts": [{ "text": "Your system prompt here" }]
    },
    "realtimeInputConfig": {
      "automaticActivityDetection": {
        "disabled": false,
        "startOfSpeechSensitivity": "START_SENSITIVITY_HIGH",
        "prefixPaddingMs": 200,
        "endOfSpeechSensitivity": "END_SENSITIVITY_HIGH",
        "silenceDurationMs": 600
      },
      "activityHandling": "START_OF_ACTIVITY_INTERRUPTS"
    },
    "inputAudioTranscription": {},
    "outputAudioTranscription": {}
  }
}
```

### Send Text Message
```json
{
  "clientContent": {
    "turns": [{
      "role": "user",
      "parts": [{ "text": "Hello!" }]
    }],
    "turnComplete": true
  }
}
```

### Send Audio Stream
```json
{
  "realtimeInput": {
    "audio": {
      "data": "base64_encoded_audio_data",
      "mimeType": "audio/pcm"
    }
  }
}
```

### Receive Audio Response
```json
{
  "serverContent": {
    "modelTurn": {
      "parts": [{
        "inlineData": {
          "data": "base64_encoded_audio_data",
          "mimeType": "audio/pcm"
        }
      }]
    },
    "turnComplete": false,
    "generationComplete": false
  }
}
```

### Receive Transcription
```json
{
  "serverContent": {
    "inputTranscription": "user speech transcription",
    "outputTranscription": "assistant speech transcription"
  }
}
```

### Interruption
```json
{
  "serverContent": {
    "interrupted": true
  }
}
```

## Activity Handling Modes
- **`START_OF_ACTIVITY_INTERRUPTS`** (Default) - User speech interrupts assistant
- **`NO_INTERRUPTION`** - Assistant completes response before accepting new input

## Configuration Timing

### Prefix Padding (`prefixPaddingMs`)
- Default: 200ms
- Range: 50-1000ms
- Purpose: Duration of detected speech before start-of-speech is committed
- Lower values = more sensitive, faster detection, more false positives

### Silence Duration (`silenceDurationMs`)
- Default: 600ms
- Range: 100-3000ms
- Purpose: Duration of silence before end-of-speech is committed
- Higher values = longer pauses allowed, slower turn-taking

## Rate Limits
- Check current limits at: https://ai.google.dev/gemini-api/docs/quota
- Typical limits:
  - Requests per minute: 60-300 (varies by tier)
  - Audio streaming: Continuous with proper handling
  - Concurrent connections: 10-50 (varies by tier)

## Error Codes
- **400**: Invalid request format
- **401**: Invalid API key
- **403**: API not enabled or quota exceeded
- **429**: Rate limit exceeded
- **500**: Internal server error

## Best Practices

### Audio Quality
- Use clean audio input (minimize background noise)
- Ensure proper μ-law encoding
- Maintain consistent sample rate (8kHz)
- Send audio chunks regularly (every 20ms recommended)

### Activity Detection
- Use `START_SENSITIVITY_HIGH` for conversational AI
- Increase `silenceDurationMs` for users with speech pauses
- Enable automatic detection for natural conversations
- Use manual activity signals only for special use cases

### Interruption Handling
- Keep `START_OF_ACTIVITY_INTERRUPTS` enabled for responsive UX
- Handle `interrupted` flag to stop audio playback immediately
- Clear audio buffers on interruption

### Performance Optimization
- Process messages asynchronously
- Buffer audio packets efficiently (max 640 bytes recommended)
- Use message queues for high-throughput scenarios
- Monitor WebSocket connection health

## Debugging Tips
1. **Enable debug logging:** Set `LOG_LEVEL=debug` in config
2. **Check API key:** Verify at https://aistudio.google.com/app/apikey
3. **Monitor WebSocket:** Look for connection/disconnection messages
4. **Inspect audio flow:** Check RTP packet counts and buffer sizes
5. **Review transcriptions:** Ensure text appears for both user and assistant

## Resources
- Official Documentation: https://ai.google.dev/api/live
- API Reference: https://ai.google.dev/api/generate-content
- Python SDK: https://github.com/googleapis/python-genai
- Community Support: Google AI Developer Forums
