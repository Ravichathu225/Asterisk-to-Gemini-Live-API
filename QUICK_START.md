 2025-10-08T10:15:32.234Z [INFO] [Client] Session setup complete for 1234567890.123
C-0003 | 2025-10-08T10:15:32.345Z [INFO] [Client] Sending initial message for 1234567890.123: Hi
O-0001 | 2025-10-08T10:15:33.456Z [INFO] [OpenAI] Received audio delta for 1234567890.123: 1280 bytes
O-0002 | 2025-10-08T10:15:33.567Z [INFO] [OpenAI] Assistant transcription for 1234567890.123: Hello! I'm Sofia...
O-0003 | 2025-10-08T10:15:35.678Z [INFO] [OpenAI] User command transcription for 1234567890.123: Hi, what is your name?
```

## Configuration Options

### Essential Settings (Already Configured)
```conf
GEMINI_API_KEY=your_key_here              # Your API key
GEMINI_MODEL=models/gemini-2.0-flash-exp  # AI model
GEMINI_VOICE=Puck                         # Voice style
SYSTEM_PROMPT="Your assistant persona"    # AI instructions
INITIAL_MESSAGE=Hi                        # First message
```

### Optional Tweaks
```conf
# Speech Detection
START_SENSITIVITY=START_SENSITIVITY_HIGH   # HIGH or LOW
END_SENSITIVITY=END_SENSITIVITY_HIGH       # HIGH or LOW
VAD_PREFIX_PADDING_MS=200                  # 50-1000 (speech start delay)
VAD_SILENCE_DURATION_MS=600                # 100-3000 (silence before end)

# Audio Settings
SILENCE_PADDING_MS=100                     # Audio padding

# Call Management
MAX_CONCURRENT_CALLS=10                    # Max simultaneous calls
CALL_DURATION_LIMIT_SECONDS=300            # Max call length (0=unlimited)

# Debugging
LOG_LEVEL=info                             # info, debug, error, warn
```

## Voice Options

Change `GEMINI_VOICE` to one of:
- **Puck** (Default) - Friendly, conversational
- **Charon** - Deep, authoritative
- **Kore** - Warm, professional
- **Fenrir** - Dynamic, energetic
- **Aoede** - Calm, soothing

## Troubleshooting

### Problem: "GEMINI_API_KEY is missing"
**Solution:** 
```bash
nano config.conf
# Add: GEMINI_API_KEY=your_actual_key_here
```

### Problem: "ARI connection error"
**Solution:** Check Asterisk is running
```bash
sudo systemctl status asterisk
sudo asterisk -rx "ari show status"
```

### Problem: No audio in call
**Solution:** Check RTP configuration
```bash
# Edit asterisk.js if needed
# Ensure external_host uses correct IP
```

### Problem: No transcriptions
**Solution:** Enable debug logging
```bash
# In config.conf, change:
LOG_LEVEL=debug
# Restart: node index.js
```

### Problem: WebSocket disconnects
**Solution:** Check API key validity
- Visit https://aistudio.google.com/app/apikey
- Verify key is active
- Check quota limits

## Advanced Configuration

### Adjust Speech Detection Sensitivity

**More Sensitive (Faster Response, May Have False Triggers):**
```conf
START_SENSITIVITY=START_SENSITIVITY_HIGH
VAD_PREFIX_PADDING_MS=100
VAD_SILENCE_DURATION_MS=400
```

**Less Sensitive (More Accurate, Slower Response):**
```conf
START_SENSITIVITY=START_SENSITIVITY_LOW
VAD_PREFIX_PADDING_MS=300
VAD_SILENCE_DURATION_MS=800
```

### Custom System Prompt

Edit `SYSTEM_PROMPT` in `config.conf`:
```conf
SYSTEM_PROMPT="You are a helpful customer service agent for Acme Corp. Be professional, friendly, and concise. Answer questions about products, orders, and support."
```

### Multiple Concurrent Calls

Increase capacity:
```conf
MAX_CONCURRENT_CALLS=20
```

Ensure enough RTP ports available:
- Default starts at port 12000
- Each call uses 1 port
- Ensure firewall allows 12000-12020 (for 20 calls)

## Performance Tips

### Optimize for Low Latency
```conf
START_SENSITIVITY=START_SENSITIVITY_HIGH
VAD_PREFIX_PADDING_MS=150
VAD_SILENCE_DURATION_MS=500
SILENCE_PADDING_MS=50
```

### Optimize for Accuracy
```conf
START_SENSITIVITY=START_SENSITIVITY_LOW
VAD_PREFIX_PADDING_MS=250
VAD_SILENCE_DURATION_MS=700
SILENCE_PADDING_MS=100
```

### Reduce False Interruptions
If the assistant gets interrupted by background noise:
```conf
START_SENSITIVITY=START_SENSITIVITY_LOW
VAD_PREFIX_PADDING_MS=300
```

## Monitoring

### Real-time Logs
```bash
node index.js | tee asterisk_gemini.log
```

### Asterisk Logs
```bash
tail -f /var/log/asterisk/messages
```

### Check Active Calls
```bash
sudo asterisk -rx "core show channels"
```

### Check RTP Sessions
```bash
netstat -an | grep 12000
```

## Stopping the Application

Press `Ctrl+C` to gracefully shut down:
```
Received SIGINT, cleaning up...
WebSocket closed for 1234567890.123
Stream handler ended for 1234567890.123
RTP sender socket closed for 1234567890.123
Cleanup completed
```

## Running as a Service

Create systemd service:
```bash
sudo nano /etc/systemd/system/asterisk-gemini.service
```

Add:
```ini
[Unit]
Description=Asterisk to Gemini Live API
After=asterisk.service

[Service]
Type=simple
User=asterisk
WorkingDirectory=/home/YOUR_USER/asterisk_to_gemini_rt_community
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable asterisk-gemini
sudo systemctl start asterisk-gemini
sudo systemctl status asterisk-gemini
```

View logs:
```bash
sudo journalctl -u asterisk-gemini -f
```

## Security Best Practices

### Protect API Key
```bash
chmod 600 config.conf
```

### Use Environment Variables (Optional)
```bash
export GEMINI_API_KEY="your_key_here"
# Remove GEMINI_API_KEY from config.conf
```

### Firewall Configuration
```bash
# Allow only necessary ports
sudo ufw allow 5060/udp  # SIP
sudo ufw allow 8088/tcp  # ARI
sudo ufw allow 12000:12100/udp  # RTP
sudo ufw enable
```

## Next Steps

1. **Customize System Prompt** - Make the assistant your own
2. **Test Different Voices** - Find the best voice for your use case
3. **Adjust Sensitivity** - Fine-tune for your environment
4. **Monitor Usage** - Check Gemini API usage dashboard
5. **Scale Up** - Increase concurrent calls as needed

## Getting Help

- **Documentation:** See `README.md`, `MIGRATION_GUIDE.md`, `GEMINI_API_REFERENCE.md`
- **Logs:** Set `LOG_LEVEL=debug` for detailed output
- **Community:** Google AI Developer Forums
- **Issues:** GitHub repository issues page

## Quick Reference Commands

```bash
# Start application
node index.js

# Start with debug logs
LOG_LEVEL=debug node index.js

# Check Asterisk status
sudo systemctl status asterisk

# View Asterisk CLI
sudo asterisk -rvvv

# Test SIP registration
sudo asterisk -rx "pjsip show endpoints"

# Check active channels
sudo asterisk -rx "core show channels"

# Restart Asterisk
sudo systemctl restart asterisk

# View application logs
tail -f asterisk_gemini.log
```

---

**You're all set!** 🎉

Make a call to extension 9999 and start chatting with your Gemini-powered AI assistant!
