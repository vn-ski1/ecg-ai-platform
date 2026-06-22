require('dotenv').config();
const twilio = require('twilio');

console.log('Account SID:', process.env.TWILIO_ACCOUNT_SID?.substring(0, 12) + '...');
console.log('Auth Token: ', process.env.TWILIO_AUTH_TOKEN?.substring(0, 8) + '...');
console.log('From:       ', process.env.TWILIO_FROM_NUMBER);
console.log('Doctor:     ', process.env.DOCTOR_PHONE_NUMBER);
console.log('---');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

console.log('Sending test SMS...');
const start = Date.now();
client.messages.create({
  body: 'Test SMS from ECG platform — ' + new Date().toLocaleTimeString(),
  from: process.env.TWILIO_FROM_NUMBER,
  to: process.env.DOCTOR_PHONE_NUMBER,
})
  .then(msg => {
    console.log(`✓ Success after ${Date.now() - start}ms — SID: ${msg.sid}`);
    console.log('  Status:', msg.status);
  })
  .catch(err => {
    console.log(`✗ Failed after ${Date.now() - start}ms`);
    console.log('  Code:', err.code);
    console.log('  Status:', err.status);
    console.log('  Message:', err.message);
    console.log('  More info:', err.moreInfo);
  });