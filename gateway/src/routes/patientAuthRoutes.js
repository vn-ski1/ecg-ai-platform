const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret';
const JWT_EXPIRES_IN = '8h';
const { sendWelcomeSMS } = require('../services/smsService');
const { autoAssignInitialECGs } = require('../services/autoEcgService');
// POST /api/v1/patient-auth/signup
router.post('/signup', async (req, res) => {
  const { name, email, password, date_of_birth, phone, gender } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // Check if email already used
    const existing = await pool.query('SELECT patient_id FROM patients WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);

    // Auto-assign to the first hospital + first doctor (since patients can't pick)
    // In production this would be a doctor assignment workflow
    const hospital = await pool.query('SELECT hospital_id FROM hospitals LIMIT 1');
    const doctor = await pool.query('SELECT doctor_id FROM doctors LIMIT 1');
    const hospitalId = hospital.rows[0]?.hospital_id || null;
    const doctorId = doctor.rows[0]?.doctor_id || null;

    const result = await pool.query(
      `INSERT INTO patients
       (name, email, password_hash, date_of_birth, phone, gender, hospital_id, assigned_doctor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING patient_id, name, email`,
      [name, email, hash, date_of_birth || null, phone || null, gender || null, hospitalId, doctorId]
    );
    const patient = result.rows[0];

    const token = jwt.sign(
      { patient_id: patient.patient_id, email: patient.email, name: patient.name, role: 'patient' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    // Send welcome SMS (fire-and-forget — don't block signup response)
if (phone) {
  sendWelcomeSMS(phone, name);
}
    // Trigger initial ECG assignments in the background (fire-and-forget — don't block the signup response)
      autoAssignInitialECGs(patient.patient_id, hospitalId);
    res.status(201).json({
      token,
      patient: { patient_id: patient.patient_id, name: patient.name, email: patient.email }
    });
  } catch (err) {
    console.error('Patient signup error:', err.message);
    res.status(500).json({ error: 'Signup failed', detail: err.message });
  }
});

// POST /api/v1/patient-auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    const result = await pool.query(
      'SELECT patient_id, name, email, password_hash FROM patients WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const patient = result.rows[0];
    if (!patient.password_hash) {
      return res.status(401).json({ error: 'This account was not registered through the patient signup flow' });
    }
    const valid = await bcrypt.compare(password, patient.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { patient_id: patient.patient_id, email: patient.email, name: patient.name, role: 'patient' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      patient: { patient_id: patient.patient_id, name: patient.name, email: patient.email }
    });
  } catch (err) {
    console.error('Patient login error:', err.message);
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
});

// Middleware: verify a patient JWT
function authenticatePatient(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'patient') {
      return res.status(403).json({ error: 'Patient token required' });
    }
    req.patient = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// GET /api/v1/patient-auth/me — fetch the logged-in patient's own data
router.get('/me', authenticatePatient, async (req, res) => {
  try {
    const patientResult = await pool.query(
      `SELECT p.patient_id, p.name, p.email, p.date_of_birth, p.phone, p.gender,
              h.hospital_name, d.name AS doctor_name, d.specialty AS doctor_specialty, d.phone AS doctor_phone
       FROM patients p
       LEFT JOIN hospitals h ON h.hospital_id = p.hospital_id
       LEFT JOIN doctors d ON d.doctor_id = p.assigned_doctor_id
       WHERE p.patient_id = $1`,
      [req.patient.patient_id]
    );
    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const recordsResult = await pool.query(
      `SELECT record_id, recorded_at, rhythm_class, confidence, bpm,
              cvd_risk_score, cvd_risk_category, signal_data, created_at
       FROM ecg_records WHERE patient_id = $1 ORDER BY created_at DESC`,
      [req.patient.patient_id]
    );

    const alertsResult = await pool.query(
      `SELECT alert_id, risk_level, risk_score, rhythm_class, message, status, created_at, resolved_at
       FROM alerts WHERE patient_id = $1 ORDER BY created_at DESC`,
      [req.patient.patient_id]
    );

    res.json({
      patient: patientResult.rows[0],
      ecg_records: recordsResult.rows,
      alerts: alertsResult.rows
    });
  } catch (err) {
    console.error('GET /me error:', err.message);
    res.status(500).json({ error: 'Failed to fetch patient data', detail: err.message });
  }
});

module.exports = { router, authenticatePatient };