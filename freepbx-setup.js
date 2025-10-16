const express = require('express');
const AmiClient = require('asterisk-ami-client');
const { config, logger } = require('./config');

// Configuration
const AMI_CONFIG = {
  host: process.env.AMI_HOST || 'localhost',
  port: parseInt(process.env.AMI_PORT) || 5038,
  username: process.env.AMI_USERNAME || 'your_username',
  secret: process.env.AMI_SECRET || 'your_secret'
};

const ARI_PASSWORD = config.ARI_PASS || 'my-ari-password';
const PROVIDER_SIP_SERVER = process.env.PROVIDER_SIP_SERVER || 'sip.telnyx.com';

// Function to create extensions_custom.conf (dialplan for Stasis)
async function createExtensionsCustom(client, didNumber) {
  logger.info('Creating extensions_custom.conf...');

  // [from-internal-custom] for extension 9999
  const extCustom1 = {
    Action: 'UpdateConfig',
    SrcFilename: 'extensions_custom.conf',
    DstFilename: 'extensions_custom.conf',
    Reload: 'yes',
    'Action-000000': 'newcat',
    'Cat-000000': 'from-internal-custom',
    'Action-000001': 'append',
    'Cat-000001': 'from-internal-custom',
    'Var-000001': 'exten',
    'Value-000001': '>9999,1,NoOp(Entering Gemini Stasis app)',
    'Action-000002': 'append',
    'Cat-000002': 'from-internal-custom',
    'Var-000002': 'exten',
    'Value-000002': '>9999,n,Answer()',
    'Action-000003': 'append',
    'Cat-000003': 'from-internal-custom',
    'Var-000003': 'exten',
    'Value-000003': '>9999,n,Stasis(asterisk_to_openai_rt)',
    'Action-000004': 'append',
    'Cat-000004': 'from-internal-custom',
    'Var-000004': 'exten',
    'Value-000004': '>9999,n,Hangup()'
  };

  // [custom-gemini] for inbound DID routing
  const extCustom2 = {
    Action: 'UpdateConfig',
    SrcFilename: 'extensions_custom.conf',
    DstFilename: 'extensions_custom.conf',
    Reload: 'yes',
    'Action-000000': 'newcat',
    'Cat-000000': 'custom-gemini',
    'Action-000001': 'append',
    'Cat-000001': 'custom-gemini',
    'Var-000001': 'exten',
    'Value-000001': `>s,1,NoOp(Entering Gemini Stasis from DID ${didNumber})`,
    'Action-000002': 'append',
    'Cat-000002': 'custom-gemini',
    'Var-000002': 'exten',
    'Value-000002': '>s,n,Answer()',
    'Action-000003': 'append',
    'Cat-000003': 'custom-gemini',
    'Var-000003': 'exten',
    'Value-000003': '>s,n,Stasis(asterisk_to_openai_rt)',
    'Action-000004': 'append',
    'Cat-000004': 'custom-gemini',
    'Var-000004': 'exten',
    'Value-000004': '>s,n,Hangup()'
  };

  const response1 = await client.action(extCustom1, true);
  logger.info('Extensions Custom 1 response:', response1);
  const response2 = await client.action(extCustom2, true);
  logger.info('Extensions Custom 2 response:', response2);

  return { extensionsCustom1: response1, extensionsCustom2: response2 };
}

// Function to create ari.conf (ARI users/apps)
async function createAriConf(client) {
  logger.info('Creating ari.conf...');

  // [general]
  const ariGeneral = {
    Action: 'UpdateConfig',
    SrcFilename: 'ari.conf',
    DstFilename: 'ari.conf',
    Reload: 'yes',
    'Action-000000': 'newcat',
    'Cat-000000': 'general',
    'Action-000001': 'append',
    'Cat-000001': 'general',
    'Var-000001': 'enabled',
    'Value-000001': 'yes',
    'Action-000002': 'append',
    'Cat-000002': 'general',
    'Var-000002': 'pretty',
    'Value-000002': 'yes',
    'Action-000003': 'append',
    'Cat-000003': 'general',
    'Var-000003': 'allowed_origins',
    'Value-000003': '*'
  };

  // [asterisk] user
  const ariUser = {
    Action: 'UpdateConfig',
    SrcFilename: 'ari.conf',
    DstFilename: 'ari.conf',
    Reload: 'yes',
    'Action-000000': 'newcat',
    'Cat-000000': 'asterisk',
    'Action-000001': 'append',
    'Cat-000001': 'asterisk',
    'Var-000001': 'type',
    'Value-000001': 'user',
    'Action-000002': 'append',
    'Cat-000002': 'asterisk',
    'Var-000002': 'read_only',
    'Value-000002': 'no',
    'Action-000003': 'append',
    'Cat-000003': 'asterisk',
    'Var-000003': 'password',
    'Value-000003': ARI_PASSWORD
  };

  const response1 = await client.action(ariGeneral, true);
  logger.info('ARI General response:', response1);
  const response2 = await client.action(ariUser, true);
  logger.info('ARI User response:', response2);

  return { ariGeneral: response1, ariUser: response2 };
}

// Function to create pjsip_custom.conf (custom PJSIP for inbound trunk)
async function createPjsipCustom(client, didNumber) {
  logger.info('Creating pjsip_custom.conf...');

  // [my-did-trunk] endpoint
  const pjsip1 = {
    Action: 'UpdateConfig',
    SrcFilename: 'pjsip_custom.conf',
    DstFilename: 'pjsip_custom.conf',
    Reload: 'yes',
    'Action-000000': 'newcat',
    'Cat-000000': 'my-did-trunk',
    'Action-000001': 'append',
    'Cat-000001': 'my-did-trunk',
    'Var-000001': 'type',
    'Value-000001': 'endpoint',
    'Action-000002': 'append',
    'Cat-000002': 'my-did-trunk',
    'Var-000002': 'context',
    'Value-000002': 'from-trunk',
    'Action-000003': 'append',
    'Cat-000003': 'my-did-trunk',
    'Var-000003': 'disallow',
    'Value-000003': 'all',
    'Action-000004': 'append',
    'Cat-000004': 'my-did-trunk',
    'Var-000004': 'allow',
    'Value-000004': 'ulaw,alaw,g722',
    'Action-000005': 'append',
    'Cat-000005': 'my-did-trunk',
    'Var-000005': 'direct_media',
    'Value-000005': 'no',
    'Action-000006': 'append',
    'Cat-000006': 'my-did-trunk',
    'Var-000006': 'force_rport',
    'Value-000006': 'yes',
    'Action-000007': 'append',
    'Cat-000007': 'my-did-trunk',
    'Var-000007': 'rtp_symmetric',
    'Value-000007': 'yes',
    'Action-000008': 'append',
    'Cat-000008': 'my-did-trunk',
    'Var-000008': 'ice_support',
    'Value-000008': 'no',
    'Action-000009': 'append',
    'Cat-000009': 'my-did-trunk',
    'Var-000009': 'use_avpf',
    'Value-000009': 'no',
    'Action-000010': 'append',
    'Cat-000010': 'my-did-trunk',
    'Var-000010': 'rtcp_mux',
    'Value-000010': 'no',
    'Action-000011': 'append',
    'Cat-000011': 'my-did-trunk',
    'Var-000011': 'media_encryption',
    'Value-000011': 'no',
    'Action-000012': 'append',
    'Cat-000012': 'my-did-trunk',
    'Var-000012': 'contact_user',
    'Value-000012': didNumber
  };

  // [my-did-trunk-transport-udp] transport
  const pjsip2 = {
    Action: 'UpdateConfig',
    SrcFilename: 'pjsip_custom.conf',
    DstFilename: 'pjsip_custom.conf',
    Reload: 'yes',
    'Action-000000': 'newcat',
    'Cat-000000': 'my-did-trunk-transport-udp',
    'Action-000001': 'append',
    'Cat-000001': 'my-did-trunk-transport-udp',
    'Var-000001': 'type',
    'Value-000001': 'transport',
    'Action-000002': 'append',
    'Cat-000002': 'my-did-trunk-transport-udp',
    'Var-000002': 'protocol',
    'Value-000002': 'udp',
    'Action-000003': 'append',
    'Cat-000003': 'my-did-trunk-transport-udp',
    'Var-000003': 'bind',
    'Value-000003': '0.0.0.0:5060'
  };

  // [my-did-trunk-aor] AOR
  const pjsip3 = {
    Action: 'UpdateConfig',
    SrcFilename: 'pjsip_custom.conf',
    DstFilename: 'pjsip_custom.conf',
    Reload: 'yes',
    'Action-000000': 'newcat',
    'Cat-000000': 'my-did-trunk-aor',
    'Action-000001': 'append',
    'Cat-000001': 'my-did-trunk-aor',
    'Var-000001': 'type',
    'Value-000001': 'aor',
    'Action-000002': 'append',
    'Cat-000002': 'my-did-trunk-aor',
    'Var-000002': 'contact',
    'Value-000002': `sip:${PROVIDER_SIP_SERVER}:5060`
  };

  const response1 = await client.action(pjsip1, true);
  logger.info('PJSIP Custom 1 response:', response1);
  const response2 = await client.action(pjsip2, true);
  logger.info('PJSIP Custom 2 response:', response2);
  const response3 = await client.action(pjsip3, true);
  logger.info('PJSIP Custom 3 response:', response3);

  return { pjsipCustom1: response1, pjsipCustom2: response2, pjsipCustom3: response3 };
}

// Function to create inbound route in extensions_additional.conf
async function createInboundRoute(client, didNumber) {
  logger.info('Appending inbound route to extensions_additional.conf...');

  const inboundRoute = {
    Action: 'UpdateConfig',
    SrcFilename: 'extensions_additional.conf',
    DstFilename: 'extensions_additional.conf',
    Reload: 'yes',
    'Action-000000': 'append',
    'Cat-000000': 'from-trunk',
    'Var-000000': 'exten',
    'Value-000000': `${didNumber},1,NoOp(Incoming call from DID: ${didNumber})`,
    'Action-000001': 'append',
    'Cat-000001': 'from-trunk',
    'Var-000001': 'exten',
    'Value-000001': `${didNumber},n,Goto(custom-gemini,s,1)`,
    'Action-000002': 'append',
    'Cat-000002': 'from-trunk',
    'Var-000002': 'exten',
    'Value-000002': `${didNumber},n,Hangup()`
  };

  const response = await client.action(inboundRoute, true);
  logger.info('Inbound Route response:', response);

  return { inboundRoute: response };
}

// Optional: Function to update logger.conf for debugging
async function createLoggerConf(client) {
  logger.info('Updating logger.conf...');

  const loggerConf = {
    Action: 'UpdateConfig',
    SrcFilename: 'logger.conf',
    DstFilename: 'logger.conf',
    Reload: 'yes',
    'Action-000000': 'newcat',
    'Cat-000000': 'logfiles',
    'Action-000001': 'append',
    'Cat-000001': 'logfiles',
    'Var-000001': 'full',
    'Value-000001': 'notice,warning,error,debug,verbose',
    'Action-000002': 'append',
    'Cat-000002': 'logfiles',
    'Var-000002': 'console',
    'Value-000002': 'notice,warning,error,debug,verbose',
    'Action-000003': 'append',
    'Cat-000003': 'logfiles',
    'Var-000003': 'messages',
    'Value-000003': 'notice,warning,error'
  };

  const response = await client.action(loggerConf, true);
  logger.info('Logger Conf response:', response);

  return { loggerConf: response };
}

// API function to handle full FreePBX config creation
async function applyFullFreePBXConfig(didNumber) {
  if (!didNumber) {
    throw new Error('DID number is required');
  }

  const client = new AmiClient({ reconnect: true, keepAlive: true });

  try {
    await client.connect(AMI_CONFIG.username, AMI_CONFIG.secret, {
      host: AMI_CONFIG.host,
      port: AMI_CONFIG.port
    });

    logger.info('Connected to AMI');

    // Apply configurations in order
    const extensionsCustomResponses = await createExtensionsCustom(client, didNumber);
    const ariConfResponses = await createAriConf(client);
    const pjsipCustomResponses = await createPjsipCustom(client, didNumber);
    const inboundRouteResponse = await createInboundRoute(client, didNumber);
    const loggerConfResponse = await createLoggerConf(client);

    logger.info('Full FreePBX configuration applied successfully');
    logger.info(`Note: Set ARI credentials in your Stasis app to username: asterisk, password: ${ARI_PASSWORD}`);
    logger.info(`Note: Inbound route in extensions_additional.conf is auto-generated by FreePBX; verify after fwconsole reload.`);
    logger.info(`Note: For full trunk setup (auth/registration), use FreePBX GUI or REST API with your provider credentials.`);

    return {
      success: true,
      message: 'Full FreePBX configuration applied successfully',
      did: didNumber,
      ariPassword: ARI_PASSWORD,
      responses: {
        extensionsCustom: extensionsCustomResponses,
        ariConf: ariConfResponses,
        pjsipCustom: pjsipCustomResponses,
        inboundRoute: inboundRouteResponse,
        loggerConf: loggerConfResponse
      }
    };
  } catch (error) {
    logger.error('Error applying full FreePBX config:', error);
    throw error;
  } finally {
    client.disconnect();
  }
}

// Express app setup
const app = express();
const PORT = process.env.FREEPBX_SETUP_PORT || 3000;
const HOST = process.env.API_HOST || '0.0.0.0'; // Listen on all interfaces for public access

app.use(express.json());

// API endpoint: POST /api/setup-freepbx
app.post('/api/setup-freepbx', async (req, res) => {
  try {
    const { did } = req.body;
    if (!did) {
      return res.status(400).json({
        success: false,
        message: 'DID number is required in request body (e.g., { "did": "+16592448782" })'
      });
    }
    const result = await applyFullFreePBXConfig(did);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to apply full FreePBX configuration',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server only if not imported as module
if (require.main === module) {
  app.listen(PORT, HOST, () => {
    logger.info(`FreePBX Setup API running on ${HOST}:${PORT}`);
    logger.info(`Local access: http://localhost:${PORT}/api/setup-freepbx`);
    logger.info(`Public access: http://54.234.25.21:${PORT}/api/setup-freepbx`);
    logger.info(`Health check: http://54.234.25.21:${PORT}/api/health`);
    logger.info(`Example request: { "did": "+16592448782" }`);
  });
}

module.exports = { applyFullFreePBXConfig, app };
