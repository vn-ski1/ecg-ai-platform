require('dotenv').config();
const { sendWelcomeEmail } = require('./src/services/emailService');

const TEST_EMAIL = process.argv[2];

if (!TEST_EMAIL) {
  console.error('Usage: node test-email.js your-email@example.com');
  process.exit(1);
}

console.log(`Sending test email to ${TEST_EMAIL}...`);

sendWelcomeEmail(TEST_EMAIL, 'EKWE DANIEL FLORIAN')
  .then(() => {
    console.log('Done. Check the inbox of', TEST_EMAIL);
    process.exit(0);
  })
  .catch(err => {
    console.error('Test failed:', err.message);
    process.exit(1);
  });