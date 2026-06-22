const axios = require('axios');

const signal = new Array(360).fill(0.0);

axios.post(
  'http://localhost:3000/api/v1/ecg/upload',
  {
    patient_id: 1,
    signal: signal,
    rr_interval: 0.8
  },
  {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'test-hospital-api-key-12345'
    }
  }
).then(response => {
  console.log('SUCCESS — gateway response:');
  console.log(JSON.stringify(response.data, null, 2));
}).catch(err => {
  console.log('--- FULL ERROR DETAILS ---');
  if (err.response) {
    console.log('HTTP status:', err.response.status);
    console.log('Body:', JSON.stringify(err.response.data, null, 2));
  } else if (err.code) {
    console.log('Code:', err.code);
    console.log('Message:', err.message);
    console.log('(This usually means nothing is listening at that URL)');
  } else {
    console.log('Raw error:', err);
  }
});