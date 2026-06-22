const axios = require('axios');

axios.post('http://localhost:3000/api/v1/auth/login', {
  email: 'mbarga@hgd.cm',
  password: 'doctor123'
})
.then(response => {
  console.log('LOGIN SUCCESS:');
  console.log('Doctor:', response.data.doctor);
  console.log('Token (first 60 chars):', response.data.token.substring(0, 60) + '...');
})
.catch(err => {
  if (err.response) {
    console.log('HTTP', err.response.status);
    console.log('Body:', err.response.data);
  } else {
    console.log('Error:', err.message);
  }
});