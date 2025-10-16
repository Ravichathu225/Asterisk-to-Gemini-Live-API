const {config, logger} = require('./config');
const {exec} = require('child_process');
const fs = require('fs');
const axios = require('axios');

const tinybird_token = config.TINYBIRD_API_TOKEN;
const tinybird_sql_endpoint = "https://api.tinybird.co/v0/sql";

const bubble_token = config.BUBBLE_API_TOKEN;
const bubble_endpoint_url = config.BUBBLE_API_ENDPOINT_URL;


class AgentSetting {
  constructor(phoneNumber = null) {
    this.phoneNumber = phoneNumber;
    this.prompt = null;
    this.voice = null;
    this.firstSentence = null;
    this.name = null;
    this.userId = null;
    this.accountBalance = 0;
    this.temperature = null;
    this.maxTokens = null;
    this.documentData = null;
    this.generateResponseModel = null;
    this.agentId = null;
    this.orgUid = null;
    this.otrixMainPrompt = null;
    this.costOfCall = 0.27;
  }

  async _fetchAccountBalance(orgUid) {
    if(!orgUid){
        logger.warn('orgUid is not set. Cannot fetch account balance.');
        return;
    }
    const url = `${bubble_endpoint_url}/account_balance`;
    const headers = {
        Authorization: `Bearer ${bubble_token}`,
        'Content-Type': 'application/json'
    };
    const params = {org_uid: orgUid};

    try{
        const response = await axios.get(url, {headers, params, timeout: 1000});
        const data = response.data;
        const account_balance = data?.response?.account_balance?? 0;
        console.info(`Fetched account balance: ${account_balance} for org_uid: ${orgUid}`);
        return account_balance;
    }catch (error) {
      if (error.response) {
        console.error(`HTTP error fetching account balance from Bubble.io: ${error.response.status}`);
      } else {
        console.error(`Error fetching account balance from Bubble.io: ${error.message}`);
      }
      return 0;
  }
}

  async _fetchAgentSettings() {
    if(this.phoneNumber === null){
        config.error('Phone number is not set. Cannot fetch agent settings.');
        throw new Error('Phone number is not set.');
    }
    const url = tinybird_sql_endpoint;
    const headers = {
        Authorization: `Bearer ${tinybird_token}`,
        'Content-Type': 'application/json'
    };
     const query = `
      SELECT * FROM call_ai_agent_mobile_number_twilio t
      INNER JOIN call_agent_ai a ON t.call_ai_agent_id = a.agent_uid
      WHERE t.twilio_phone_no = '${this.phoneNumber}' FORMAT JSON
    `;
    const params = new URLSearchParams({q: query.trim()});
    try {
        const response = await axios.get(url, {headers, params, timeout: 1000});
        const agent_setting_data = response.data;

        if(!agent_setting_data.data || agent_setting_data.data.length === 0){
            logger.warn(`No agent settings found for phone number: ${this.phoneNumber}`);
            throw new Error("No agent settings found.");
        }
        const agentData = agent_setting_data.data[0];
        const orgUid = agentData.org_uid;
        const accountBalance = await this._fetchAccountBalance(orgUid);

        //map the data to class properties
        this.prompt = agentData.agent_prompt;
        this.voice = agentData.agent_voice;
        this.firstSentence = agentData.first_sentence;
        this.name = agentData.agent_name;
        this.userId = agentData.phone_no_uid;
        this.accountBalance = accountBalance;
        this.temperature = agentData.agent_temperature;
        this.maxTokens = agentData.max_tokens;
        this.twilioAccountId = agentData.twilio_account_sid;
        this.twilioAccountToken = agentData.twilio_account_token;
        this.documentData = agentData.knowledge_base;
        this.generateResponseModel = agentData.generate_response_model;
        this.agentId = agentData.call_ai_agent_id;
        this.orgUid = orgUid;
        this.transferNumber = agentData.transfer_number || null;
        this.otrixMainPrompt = agentData.otrix_main_prompt || null;
        this.costOfCall = agentData.cost_of_call ?? 0.27;

        console.info(`✅ Successfully fetched and mapped prompt data for phone number: ${this.phoneNumber} and org_uid: ${orgUid}`);

    } catch (error) {
      if (error.response) {
        console.error(`HTTP error fetching prompt data from Tinybird: ${error.response.status}`);
        throw new Error(`Error: ${error.response.status} - ${error.response.data}`);
      } else {
        console.error(`Error fetching prompt data from Tinybird: ${error.message}`);
        throw error;
      }
    }
}
// // Example usage:
//     async _fetchPromptData() {
//       const agentData = new AgentSetting("+18564637598");
//       await agentData._fetchPromptData();
//     }
// }

// function setAgentSettings(phoneNumber) {
//   if(!phoneNumber || phoneNumber.trim() === ''){
//       throw new Error('Phone number is required to set agent settings.');
//   }
//   (async () => {
//     try {
//       const agentData = new AgentSetting(phoneNumber);
//       await agentData._fetchAgentSettings();
//       console.log("Agent Setting Data:");
//       console.log({
//         prompt: agentData.prompt,
//         voice: agentData.voice,
//         firstSentence: agentData.firstSentence,
//         name: agentData.name,
//         userId: agentData.userId,
//         accountBalance: agentData.accountBalance,
//         temperature: agentData.temperature,
//         maxTokens: agentData.maxTokens,
//         twilioAccountId: agentData.twilioAccountId,
//         twilioAccountToken: agentData.twilioAccountToken,
//         documentData: agentData.documentData,
//         generateResponseModel: agentData.generateResponseModel,
//         agentId: agentData.agentId,
//         orgUid: agentData.orgUid,
//         transferNumber: agentData.transferNumber,
//         otrixMainPrompt: agentData.otrixMainPrompt,
//         costOfCall: agentData.costOfCall,
//       });
//     } catch (err) {
//       console.error("Error:", err.message);
//     }
//   })();

}

    


module.exports = {AgentSetting};
