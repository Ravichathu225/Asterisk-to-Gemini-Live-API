# Migration from OpenAI Realtime API to Gemini Live API

## Overview
This repository has been successfully migrated from OpenAI's Realtime API to Google's Gemini Live API while maintaining all core functionality.

## Key Changes

### 1. New Files Created
- **`gemini.js`**: Replaces `openai.js` with Gemini Live API implementation
  - Uses Gemini's WebSocket endpoint
  - Implements Gemini's message format (setup, clientContent, realtimeInput, serverContent)
  - Handles Gemini's audio format (PCM with base64 encoding)
  - Supports automatic activity detection and interruption handling

### 2. Modified Files

#### `config.js`
- Replaced `OPENAI_API_KEY` with `GEMINI_API_KEY`
- Replaced `REALTIME_URL` with `GEMINI_REALTIME_URL`
- Added Gemini-specific configurations:
  - `GEMINI_MODEL`: Model selection (default: `models/gemini-2.0-flash-exp`)
  - `GEMINI_VOICE`: Voice selection (Puck, Charon, Kore, Fenrir, Aoede)
  - `START_SENSITIVITY`: Speech detection sensitivity
  - `END_SENSITIVITY`: End of speech detection sensitivity

#### `config.conf`
- Changed `OPENAI_API_KEY=` to `GEMINI_API_KEY=`
- Removed `REALTIME_MODEL` and `VAD_THRESHOLD`
- Added:
  - `GEMINI_MODEL=models/gemini-2.0-flash-exp`
  - `GEMINI_VOICE=Puck`
  - `START_SENSITIVITY=START_SENSITIVITY_HIGH`
  - `END_SENSITIVITY=END_SENSITIVITY_HIGH`

#### `asterisk.js`
- Changed import: `require('./openai')` → `require('./gemini')`
- Changed function call: `startOpenAIWebSocket()` → `startGeminiWebSocket()`

#### `rtp.js`
- Updated RTP receiver to send audio in Gemini's format:
  - Uses `realtimeInput` message type
  - Includes `audio` object with `data` and `mimeType: 'audio/pcm'`

#### `package.json`
- Updated package name: `asterisk_to_gemini_rt_community`
- Updated description

#### `README.md`
- Complete rewrite for Gemini Live API
- Updated API endpoint URLs
- Added Gemini API key instructions
- Documented Gemini-specific configuration options
- Added audio format notes
- Included differences section

### 3. Unchanged Files
- `index.js`: Entry point remains the same
- `state.js`: State management unchanged
- `audio.js`: Audio conversion utilities unchanged (μ-law ↔ PCM)
- `.gitignore`: No changes needed

## API Differences Handled

### Message Format
**OpenAI:**
```javascript
{
  type: 'session.update',
  session: { ... }
}
```

**Gemini:**
```javascript
{
  setup: {
    model: '...',
    generationConfig: { ... }
  }
}
```

### Audio Input
**OpenAI:**
```javascript
{
  type: 'input_audio_buffer.append',
  audio: base64_data
}
```

**Gemini:**
```javascript
{
  realtimeInput: {
    audio: {
      data: base64_data,
      mimeType: 'audio/pcm'
    }
  }
}
```

### Audio Output
**OpenAI:**
```javascript
{
  type: 'response.audio.delta',
  delta: base64_data
}
```

**Gemini:**
```javascript
{
  serverContent: {
    modelTurn: {
      parts: [{
        inlineData: {
          data: base64_data,
          mimeType: 'audio/pcm'
        }
      }]
    }
  }
}
```

### Voice Activity Detection (VAD)
**OpenAI:**
- Uses `turn_detection` with threshold values (0.0-1.0)

**Gemini:**
- Uses `automaticActivityDetection` with sensitivity levels
- Options: `START_SENSITIVITY_HIGH/LOW`, `END_SENSITIVITY_HIGH/LOW`

## Audio Conversion
The system maintains compatibility with Asterisk's μ-law format:
1. **Incoming audio** (Asterisk → Gemini):
   - RTP packets received in μ-law format (8kHz)
   - Sent to Gemini as PCM base64-encoded

2. **Outgoing audio** (Gemini → Asterisk):
   - Received from Gemini as PCM base64-encoded
   - Sent to Asterisk via RTP in μ-law format (8kHz)

## Configuration Migration Guide

To migrate an existing OpenAI setup to Gemini:

1. **Obtain Gemini API Key:**
   - Visit https://aistudio.google.com/app/apikey
   - Create new API key

2. **Update config.conf:**
   ```conf
   # Remove
   OPENAI_API_KEY=xxx
   REALTIME_MODEL=gpt-4o-mini-realtime-preview-2024-12-17
   VAD_THRESHOLD=0.6
   
   # Add
   GEMINI_API_KEY=your_key_here
   GEMINI_MODEL=models/gemini-2.0-flash-exp
   GEMINI_VOICE=Puck
   START_SENSITIVITY=START_SENSITIVITY_HIGH
   END_SENSITIVITY=END_SENSITIVITY_HIGH
   ```

3. **Keep existing settings:**
   - All Asterisk configurations remain the same
   - RTP port settings unchanged
   - System prompt works the same way
   - Call duration limits unchanged

## Testing Checklist
- [ ] SIP registration works
- [ ] Call connects to extension 9999
- [ ] Audio is transmitted (user can hear assistant)
- [ ] Audio is received (assistant hears user)
- [ ] Transcriptions appear in console
- [ ] Interruptions work (barge-in)
- [ ] Call cleanup works properly
- [ ] Multiple concurrent calls supported

## Known Limitations
1. Gemini Live API is in beta - features may change
2. Voice options are limited to 5 choices (vs OpenAI's more options)
3. Requires Google Cloud project with API enabled
4. Rate limits may differ from OpenAI

## Future Enhancements
- Support for additional Gemini models as they become available
- Enhanced error handling for Gemini-specific errors
- Metrics and monitoring for Gemini API usage
- Support for Gemini's function calling features
