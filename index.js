const { initializeAriClient } = require('./asterisk');
const { config, logger } = require('./config');
const { app } = require('./freepbx-setup');

async function startApplication() {
  try {
    logger.info('=================================================');
    logger.info('Starting Asterisk-to-Gemini-Live-API Application');
    logger.info('=================================================');
    
    // Start FreePBX Setup API Service
    const API_PORT = process.env.FREEPBX_SETUP_PORT || 3000;
    const API_HOST = process.env.API_HOST || '0.0.0.0';
    const PUBLIC_IP = '54.234.25.21';
    
    app.listen(API_PORT, API_HOST, () => {
      logger.info('✓ FreePBX Setup API service started');
      logger.info(`✓ API running on ${API_HOST}:${API_PORT}`);
      logger.info(`✓ Public access: http://${PUBLIC_IP}:${API_PORT}`);
      logger.info(`✓ Health check: http://${PUBLIC_IP}:${API_PORT}/api/health`);
      logger.info(`✓ Setup endpoint: POST http://${PUBLIC_IP}:${API_PORT}/api/setup-freepbx`);
    });
    
    // Initialize ARI Client for call handling
    logger.info('Starting ARI client...');
    await initializeAriClient();
    logger.info('✓ ARI client initialized successfully');
    
    logger.info('=================================================');
    logger.info('Application started successfully');
    logger.info('Ready to handle incoming calls');
    logger.info('=================================================');
  } catch (e) {
    logger.error(`Startup error: ${e.message}`);
    process.exit(1);
  }
}

startApplication();
