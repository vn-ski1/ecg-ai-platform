const axios = require('axios');

axios.post('http://localhost:3000/api/v1/patient-auth/signup', {
  name: 'NDONGO Eric',
  email: 'eric.test@example.com',
  password: 'patient123',
  date_of_birth: '1985-03-22',
  phone: '+237678123456',
  gender: 'Male'
})
.then(res => {
  console.log('SIGNUP SUCCESS:');
  console.log('Patient:', res.data.patient);
  console.log('Token (first 60 chars):', res.data.token.substring(0, 60) + '...');
})
.catch(err => {
  console.log('ERROR:', err.response?.data || err.message);
});