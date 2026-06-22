// One-time script to set a real password for Dr. Mbarga
const bcrypt = require('bcrypt');
const pool = require('./src/db/pool');
require('dotenv').config();

async function setPassword() {
  const plainPassword = 'doctor123';  // The password Dr. Mbarga will type at login
  const hash = await bcrypt.hash(plainPassword, 10);

  const result = await pool.query(
    'UPDATE doctors SET password_hash = $1 WHERE email = $2 RETURNING doctor_id, name, email',
    [hash, 'mbarga@hgd.cm']
  );

  if (result.rows.length === 0) {
    console.log('No doctor found with email mbarga@hgd.cm');
  } else {
    console.log('Password updated for:', result.rows[0]);
    console.log('Login email: mbarga@hgd.cm');
    console.log('Login password: doctor123');
  }
  pool.end();
}

setPassword().catch(err => {
  console.error('Error:', err.message);
  pool.end();
});