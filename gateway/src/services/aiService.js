// Forwards ECG signals to the FastAPI AI service and returns its response
const axios = require('axios');

const AI_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

async function predictECG(signal, rrInterval) {
  try {
    const response = await axios.post(
      `${AI_URL}/predict`,
      {
        signal: signal,
        rr_interval: rrInterval
      },
      {
        timeout: 60000  // 60 seconds — TensorFlow inference can occasionally be slow
      }
    );
    return response.data;
  } catch (err) {
    if (err.response) {
      // The AI service responded with an error code (400, 422, etc.)
      throw new Error(`AI service error: ${err.response.data.detail || err.response.status}`);
    } else if (err.code === 'ECONNREFUSED') {
      throw new Error('AI service is not running. Start the FastAPI service on port 8000.');
    } else {
      throw new Error(`AI service request failed: ${err.message}`);
    }
  }
}
console.log('aiService exports check:', typeof predictECG, predictECG);
module.exports = { predictECG };