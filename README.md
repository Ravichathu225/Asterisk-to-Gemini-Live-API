# Asterisk to External AI via WebSocket

This project enables real-time voice conversations between Asterisk PBX and external AI models through WebSocket connections. It replaces the original OpenAI integration with a flexible WebSocket-based architecture that can connect to any AI model server.

## 🎯 Features

- **Real-time Voice Streaming**: Bidirectional audio streaming using G.711 μ-law codec
- **Flexible AI Integration**: Connect to any AI model via WebSocket
- **Voice Activity Detection**: Intelligent VAD for natural conversations
- **Multiple Concurrent Calls**: Support for multiple simultaneous conversations
- **RTP Audio Handling**: Direct RTP streaming for low-latency audio
- **Call Management**: Configurable call duration limits and cleanup

## 📋 Prerequisites

- Node.js (v14 or higher)
- Asterisk PBX with ARI enabled
- External AI model server with WebSocket support
- Network connectivity between Asterisk and AI server

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd asterisk_to_external_ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure the application**
   Edit `config.conf` with your settings:
   ```bash
   nano config.conf
   ```

## ⚙️ Configuration

### Essential Settings

**AI WebSocket Configuration**
- `AI_WEBSOCKET_URL`: WebSocket endpoint of your AI server (e.g., `ws://localhost:8000/ws`)
- `AI_AUTH_TOKEN`: Optional authentication token for your AI server
- `AI_VOICE`: Voice model identifier (default: `default`)
- `AI_LANGUAGE`: Language code (default: `en`)

**Asterisk ARI Configuration**
- `ARI_URL`: Asterisk REST Interface URL (default: `http://127.0.0.1:8088`)
- `ARI_USERNAME`: ARI username (default: `asterisk`)
- `ARI_PASSWORD`: ARI password (default: `asterisk`)

**System Prompts**
- `SYSTEM_PROMPT`: Instructions for the AI assistant
- `INITIAL_MESSAGE`: First message to send when call starts

### Advanced Settings

**Voice Activity Detection**
- `VAD_ENABLED`: Enable/disable VAD (default: `true`)
- `VAD_THRESHOLD`: Sensitivity threshold 0.0-1.0 (default: `0.6`)
- `VAD_SILENCE_DURATION_MS`: Silence duration before speech end (default: `600`)
- `VAD_PREFIX_PADDING_MS`: Audio padding before speech (default: `200`)

**Call Management**
- `MAX_CONCURRENT_CALLS`: Maximum simultaneous calls (default: `10`)
- `CALL_DURATION_LIMIT_SECONDS`: Max call duration, 0=unlimited (default: `300`)

**Audio Settings**
- `SILENCE_PADDING_MS`: Initial silence padding (default: `100`)
- `LOG_LEVEL`: Logging verbosity: `error`, `warn`, `info`, `debug` (default: `info`)

## 🔌 AI Server Protocol

Your external AI server must implement a WebSocket protocol. Below is the expected message format:

### Messages TO AI Server (from Asterisk)

**Session Initialization**
```json
{
  "type": "session.init",
  "config": {
    "audio_format": "g711_ulaw",
    "sample_rate": 8000,
    "channels": 1,
    "language": "en",
    "voice": "default",
    "system_prompt": "Your AI instructions...",
    "vad_enabled": true,
    "vad_threshold": 0.6,
    "vad_silence_duration_ms": 600
  }
}
```

**Audio Input**
```json
{
  "type": "audio.input",
  "audio": "base64_encoded_mulaw_audio_data",
  "format": "g711_ulaw"
}
```

**Text Input** (optional)
```json
{
  "type": "text.input",
  "text": "Hello, how can I help?"
}
```

### Messages FROM AI Server (to Asterisk)

**Session Ready**
```json
{
  "type": "session_started"
}
```
or
```json
{
  "type": "ready"
}
```

**Audio Output** (AI speech)
```json
{
  "type": "audio_delta",
  "audio": "base64_encoded_mulaw_audio_data"
}
```
or
```json
{
  "type": "audio_chunk",
  "data": "base64_encoded_mulaw_audio_data"
}
```

**Transcription**
```json
{
  "type": "transcript",
  "text": "User said something...",
  "role": "user"
}
```
or
```json
{
  "type": "transcription",
  "text": "AI response...",
  "speaker": "assistant"
}
```

**User Speech Detection**
```json
{
  "type": "user_speech_started"
}
```
or
```json
{
  "type": "speech_started"
}
```

**Response Complete**
```json
{
  "type": "response_complete"
}
```
or
```json
{
  "type": "audio_done"
}
```

**Error Handling**
```json
{
  "type": "error",
  "message": "Error description",
  "fatal": false
}
```

## 🏃 Running the Application

1. **Start your external AI server** (ensure it's running and accessible)

2. **Start the Asterisk connector**
   ```bash
   npm start
   ```

3. **Make a test call** to your Asterisk extension configured for this application

## 📞 Asterisk Configuration

### extensions.conf

```ini
[your-context]
exten => 1000,1,NoOp(External AI Call)
    same => n,Stasis(asterisk_to_external_ai)
    same => n,Hangup()
```

### ari.conf

```ini
[general]
enabled = yes
pretty = yes

[asterisk]
type = user
read_only = no
password = asterisk
```

## 🧪 Testing

1. **Check logs for connection**
   ```bash
   npm start
   ```
   Look for: `External AI WebSocket connected for [channelId]`

2. **Make a test call** and verify:
   - Audio is being sent to AI server
   - AI responses are played back
   - Transcriptions appear in logs

3. **Monitor RTP streams**
   ```bash
   # Check if RTP ports are active
   netstat -an | grep 12000
   ```

## 🔧 Customizing the AI Integration

The `external-ai.js` module contains the WebSocket protocol implementation. Modify the `processMessage()` function to match your AI server's message format:

```javascript
const processMessage = async (message) => {
  let response = JSON.parse(message);
  
  switch (response.type) {
    case 'your_custom_audio_type':
      // Handle your audio format
      break;
    case 'your_custom_transcript_type':
      // Handle your transcription format
      break;
    // Add more custom handlers
  }
};
```

## 📊 Architecture

```
┌─────────────┐      ARI/WebSocket     ┌──────────────┐
│  Asterisk   │◄─────────────────────►│    Node.js   │
│     PBX     │                        │  Application │
└─────────────┘                        └──────┬───────┘
      ▲                                       │
      │ RTP Audio (G.711 μ-law)              │
      │                                       │
      ▼                                       │
┌─────────────┐                              │
│   RTP       │                              │
│  Handler    │                              │
└─────────────┘                              │
                                             │ WebSocket
                                             │
                                             ▼
                                    ┌────────────────┐
                                    │  External AI   │
                                    │     Server     │
                                    └────────────────┘
```

## 🐛 Troubleshooting

### WebSocket Connection Issues
- Verify `AI_WEBSOCKET_URL` is correct and accessible
- Check if AI server is running and accepting connections
- Review firewall rules between Node.js and AI server
- Check authentication token if required

### Audio Quality Issues
- Verify G.711 μ-law codec support on AI server
- Check RTP packet timing and buffering
- Adjust `SILENCE_PADDING_MS` if needed
- Review `VAD_THRESHOLD` settings

### Call Not Connecting
- Verify Asterisk ARI is enabled and accessible
- Check `ARI_USERNAME` and `ARI_PASSWORD` credentials
- Ensure Asterisk dialplan routes to correct Stasis application
- Review Asterisk logs: `asterisk -rvvv`

### High Latency
- Check network latency between all components
- Reduce `VAD_SILENCE_DURATION_MS` for faster response
- Optimize AI model inference time
- Ensure RTP ports are not blocked

## 📝 Logging

The application uses color-coded logging:

- **Cyan** `[Client]`: Messages sent to AI
- **Yellow** `[AI]`: Messages received from AI
- **Gray**: General application logs

Log levels: `error`, `warn`, `info`, `debug`

Set in `config.conf`:
```
LOG_LEVEL=debug  # For detailed debugging
LOG_LEVEL=info   # For normal operation
```

## 🤝 Contributing

Contributions are welcome! Areas for improvement:

- Additional audio codec support
- Protocol adapters for popular AI APIs
- Enhanced error recovery
- Performance optimizations
- Documentation improvements

## 📄 License

[Specify your license here]

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review application logs with `LOG_LEVEL=debug`
3. Verify AI server protocol implementation
4. Check Asterisk configuration and logs

## 🔄 Migration from OpenAI

This project replaces the OpenAI Realtime API with a generic WebSocket interface. Key changes:

1. **Configuration**: Replace `OPENAI_API_KEY` with `AI_WEBSOCKET_URL`
2. **Protocol**: Implement WebSocket server matching the protocol spec
3. **Audio Format**: Ensure G.711 μ-law codec support
4. **VAD**: Configure Voice Activity Detection for your AI model

## 📚 Additional Resources

- [Asterisk ARI Documentation](https://wiki.asterisk.org/wiki/display/AST/Asterisk+REST+Interface)
- [WebSocket Protocol RFC](https://tools.ietf.org/html/rfc6455)
- [G.711 Codec Specification](https://www.itu.int/rec/T-REC-G.711)
