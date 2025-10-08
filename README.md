# Asterisk to OpenAI Realtime Community Edition

Welcome! This Node.js application integrates Asterisk 22 with the OpenAI Realtime API to provide a voice-based virtual assistant for SIP calls. It processes audio in real-time and displays user and assistant transcriptions in the console.

---

## Features
- Real-time audio processing with Asterisk and OpenAI.
- Console transcriptions for user and assistant speech.
- Clean resource management (channels, bridges, WebSocket, RTP).
- Configurable via `config.conf` (e.g., API key, prompt).

---

## Requirements
| Category      | Details                                      |
|---------------|---------------------------------------------|
| OS            | Ubuntu 24.04 LTS                            |
| Software      | - Node.js v18.20.8+ (`node -v`)<br>- Asterisk 22 with ARI enabled (`http.conf`, `ari.conf`)<br>- Node dependencies: `ari-client`, `ws`, `uuid`, `winston`, `chalk`, `dotenv` |
| Network       | - Ports: 8088 (ARI), 12000+ (RTP)<br>- Access to `wss://api.openai.com/v1/realtime` |
| Credentials   | - OpenAI API key (`OPENAI_API_KEY`)<br>- ARI credentials (`asterisk`/`asterisk`) |

---

## Update!

- Auto-install script, just run on your Ubuntun 24 instance: 
  ```bash
  curl -sL https://raw.githubusercontent.com/infinitocloud/asterisk_to_openai_rt_community/main/autoinstall_asterisk_to_openai.sh | sudo bash -s
  ```

## Installation
1. Install prerequisites:
   ```bash
   sudo apt update
   sudo apt install nodejs npm asterisk
   ```
2. Configure Asterisk:
   - Enable HTTP
     ```bash
     sudo nano /etc/asterisk/http.conf
     ```
     Add the following lines at the end of the file:
     ```ini
     enabled=yes
     bindaddr=127.0.0.1
     bindport=8088
     ```
   - Configure ARI
     ```bash
     sudo nano /etc/asterisk/ari.conf
     ```
     Add the following lines at the end of the file:
     ```ini
     [asterisk]
     type=user
     password=asterisk
     ```
   - Add dialplan
     ```bash
     sudo nano /etc/asterisk/extensions.conf
     ```
     Add the following lines at the end of the file:
     ```ini
     [default]
     exten => 9999,1,Answer()
     same => n,Stasis(asterisk_to_gemini_rt)
     same => n,Hangup()
     ```
   - Configure SIP Extensions
     ```bash
     sudo nano /etc/asterisk/pjsip.conf
     ```
     Add the following lines at the end of the file to configure SIP extension 300 that can call 9999:
     ```ini
     [transport-udp]
     type=transport
     protocol=udp
     bind=0.0.0.0
     external_media_address=3.89.115.249  ; Required: Replace with your EC2 instance's public IP from AWS console
     external_signaling_address=3.89.115.249  ; Required: Replace with your EC2 instance's public IP from AWS console
     local_net=172.31.0.0/16  ; Optional: Adjust to your VPC CIDR if different

     [300]
     type=endpoint
     context=default
     disallow=all
     allow=ulaw
     auth=300
     aors=300
     direct_media=no
     media_use_received_transport=yes
     rtp_symmetric=yes
     force_rport=yes
     rewrite_contact=yes
     dtmf_mode=auto

     [300]
     type=auth
     auth_type=userpass
     password=pass300
     username=300

     [300]
     type=aor
     max_contacts=2
     ```
   - Restart Asterisk:
     ```bash
     sudo systemctl restart asterisk
     ```
3. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/Ravichathu225/Asterisk-to-Gemini-Live-API.git
   cd asterisk_to_openai_rt_community
   npm install
   ```
4. Edit `config.conf` in the project root and add your `OPENAI_API_KEY` in the designated field:
   ```plaintext
   OPENAI_API_KEY=
   ```
5. Run the application:
   ```bash
   node index.js
   ```

---

## Usage
1. Make a SIP call to the configured extension (e.g., `9999`).
2. Interact with the assistant (e.g., say "Hi, What is your name?").
3. Check console for transcriptions:
   ```
   O-0005 | 2025-06-28T04:15:01.924Z [INFO] [OpenAI] Assistant transcription: Hello! I'm Sofia...
   O-0010 | 2025-06-28T04:15:08.045Z [INFO] [OpenAI] User command transcription: What is your name?
   ```
4. End the call or press `Ctrl+C` to stop.

---

## Troubleshooting
- Error: `OPENAI_API_KEY is missing`: Verify `OPENAI_API_KEY` in `config.conf`.
- Error: `ARI connection error`: Check Asterisk (`sudo systemctl status asterisk`, port 8088). Run: sudo asterisk -rx "ari show status"
- No transcriptions: Set `LOG_LEVEL=debug` in `config.conf`.
- Debug commands:
  - Asterisk logs: `tail -f /var/log/asterisk/messages`
  - Node.js debug: `node --inspect index.js`
- Wrong password on SIP registration: Ensure the SIP phone username is `300` and password is `pass300`. Verify the server IP matches your Asterisk instance.
- No audio: Ensure `external_media_address` and `external_signaling_address` in `pjsip.conf` match your EC2 public IP. Verify RTP ports (12000+) are open in EC2 security group and local firewall. Update `asterisk.js` `external_host` to use the server’s IP.

---

## Contributing
- Report issues with logs and steps to reproduce.
- Submit pull requests via GitHub.
- License: MIT (see `LICENSE`).
   sudo apt update
   sudo apt install nodejs npm asterisk
   ```
2. Configure Asterisk:
   - Enable HTTP
     ```bash
     sudo nano /etc/asterisk/http.conf
     ```
     Add the following lines at the end of the file:
     ```ini
     enabled=yes
     bindaddr=127.0.0.1
     bindport=8088
     ```
   - Configure ARI
     ```bash
     sudo nano /etc/asterisk/ari.conf
     ```
     Add the following lines at the end of the file:
     ```ini
     [asterisk]
     type=user
     password=asterisk
     ```
   - Add dialplan
     ```bash
     sudo nano /etc/asterisk/extensions.conf
     ```
     Add the following lines at the end of the file:
     ```ini
     [default]
     exten => 9999,1,Answer()
     same => n,Stasis(asterisk_to_openai_rt)
     same => n,Hangup()
     ```
   - Configure SIP Extensions
     ```bash
     sudo nano /etc/asterisk/pjsip.conf
     ```
     Add the following lines at the end of the file to configure SIP extension 300 that can call 9999:
     ```ini
     [transport-udp]
     type=transport
     protocol=udp
     bind=0.0.0.0
     external_media_address=3.89.115.249  ; Required: Replace with your EC2 instance's public IP from AWS console
     external_signaling_address=3.89.115.249  ; Required: Replace with your EC2 instance's public IP from AWS console
     local_net=172.31.0.0/16  ; Optional: Adjust to your VPC CIDR if different

     [300]
     type=endpoint
     context=default
     disallow=all
     allow=ulaw
     auth=300
     aors=300
     direct_media=no
     media_use_received_transport=yes
     rtp_symmetric=yes
     force_rport=yes
     rewrite_contact=yes
     dtmf_mode=auto

     [300]
     type=auth
     auth_type=userpass
     password=pass300
     username=300

     [300]
     type=aor
     max_contacts=2
     ```
   - Restart Asterisk:
     ```bash
     sudo systemctl restart asterisk
     ```
3. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/YOUR_USERNAME/asterisk_to_gemini_rt_community.git
   cd asterisk_to_gemini_rt_community
   npm install
   ```
4. Edit `config.conf` in the project root and add your `GEMINI_API_KEY` in the designated field:
   ```plaintext
   GEMINI_API_KEY=your_api_key_here
   ```
   
   To get your Gemini API key:
   - Visit https://aistudio.google.com/app/apikey
   - Sign in with your Google account
   - Click "Create API key"
   - Copy the generated key

5. Run the application:
   ```bash
   node index.js
   ```

---

## Usage
1. Make a SIP call to the configured extension (e.g., `9999`).
2. Interact with the assistant (e.g., say "Hi, What is your name?").
3. Check console for transcriptions:
   ```
   O-0005 | 2025-06-28T04:15:01.924Z [INFO] [OpenAI] Assistant transcription: Hello! I'm Sofia...
   O-0010 | 2025-06-28T04:15:08.045Z [INFO] [OpenAI] User command transcription: What is your name?
   ```
4. End the call or press `Ctrl+C` to stop.

---

## Configuration Options

The `config.conf` file supports the following Gemini-specific options:

- `GEMINI_API_KEY`: Your Google Gemini API key (required)
- `GEMINI_MODEL`: Gemini model to use (default: `models/gemini-2.0-flash-exp`)
- `GEMINI_VOICE`: Voice for audio responses (default: `Puck`)
  - Available voices: Puck, Charon, Kore, Fenrir, Aoede
- `START_SENSITIVITY`: Speech detection sensitivity (default: `START_SENSITIVITY_HIGH`)
  - Options: `START_SENSITIVITY_HIGH`, `START_SENSITIVITY_LOW`
- `END_SENSITIVITY`: End of speech detection (default: `END_SENSITIVITY_HIGH`)
  - Options: `END_SENSITIVITY_HIGH`, `END_SENSITIVITY_LOW`
- `VAD_PREFIX_PADDING_MS`: Prefix padding in milliseconds (default: 200)
- `VAD_SILENCE_DURATION_MS`: Silence duration before end of speech (default: 600)

---

## Troubleshooting
- Error: `GEMINI_API_KEY is missing`: Verify `GEMINI_API_KEY` in `config.conf`.
- Error: `ARI connection error`: Check Asterisk (`sudo systemctl status asterisk`, port 8088). Run: sudo asterisk -rx "ari show status"
- No transcriptions: Set `LOG_LEVEL=debug` in `config.conf`.
- Debug commands:
  - Asterisk logs: `tail -f /var/log/asterisk/messages`
  - Node.js debug: `node --inspect index.js`
- Wrong password on SIP registration: Ensure the SIP phone username is `300` and password is `pass300`. Verify the server IP matches your Asterisk instance.
- No audio: Ensure `external_media_address` and `external_signaling_address` in `pjsip.conf` match your EC2 public IP. Verify RTP ports (12000+) are open in EC2 security group and local firewall. Update `asterisk.js` `external_host` to use the server's IP.
- WebSocket connection issues: Verify you have access to `generativelanguage.googleapis.com`. Check your API key is valid at https://aistudio.google.com/app/apikey

---

## Audio Format Notes

Gemini Live API uses PCM audio format:
- Sample rate: 8kHz (μ-law encoded)
- Audio is sent via `realtimeInput` messages
- Responses come in `serverContent` with inline audio data
- The application handles conversion between Asterisk's RTP format and Gemini's expected format

---

## Contributing
- Report issues with logs and steps to reproduce.
- Submit pull requests via GitHub.
- License: MIT (see `LICENSE`).

---

## Differences from OpenAI Version

This version replaces OpenAI Realtime API with Google Gemini Live API:
- Uses Gemini's WebSocket endpoint and message format
- Supports Gemini's voice models (Puck, Charon, Kore, Fenrir, Aoede)
- Adapted audio handling for Gemini's PCM format
- Updated configuration for Gemini-specific parameters
- All core functionality (RTP streaming, transcription, call management) remains the same
