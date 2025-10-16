# Quick Reference: Public API Access

## Server Details
- **Public IP:** 54.234.25.21
- **API Port:** 3000
- **Platform:** AWS Ubuntu

## Quick Commands

### Start Application
```bash
cd /path/to/Asterisk-to-Gemini-Live-API
npm start

# Or with PM2 (recommended)
pm2 start index.js --name asterisk-api
pm2 save
```

### Test Health Check
```bash
curl http://54.234.25.21:3000/api/health
```

### Setup FreePBX
```bash
curl -X POST http://54.234.25.21:3000/api/setup-freepbx \
  -H "Content-Type: application/json" \
  -d '{"did": "+16592448782"}'
```

## Firewall Configuration

### AWS Security Group
1. Go to EC2 → Security Groups
2. Add Inbound Rule:
   - Type: Custom TCP
   - Port: 3000
   - Source: 0.0.0.0/0

### Ubuntu UFW
```bash
sudo ufw allow 3000/tcp
sudo ufw status
```

## Monitoring
```bash
# View logs
pm2 logs asterisk-api

# Check status
pm2 status

# Monitor resources
pm2 monit
```

## Important Files
- `.env` - Configuration (API_HOST=0.0.0.0)
- `index.js` - Main application
- `freepbx-setup.js` - API service

## Public Endpoints
- Health: http://54.234.25.21:3000/api/health
- Setup: POST http://54.234.25.21:3000/api/setup-freepbx
