const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const pool = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret';
const JWT_EXPIRES_IN = '8h';
const upload = multer({ storage: multer.memoryStorage() });
const { sendWelcomeEmail } = require('../services/emailService');
const { autoAssignInitialECGs } = require('../services/autoEcgService');

pool.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS profile_picture TEXT').catch(() => {});

/**
 * Normalize a Cameroonian phone number to E.164 format (+237XXXXXXXXX).
 */
function normalizePhone(raw) {
  if (!raw) return null;
  let p = String(raw).trim().replace(/[\s\-()]/g, '');
  if (p.startsWith('+')) return p;
  if (p.startsWith('237')) return '+' + p;
  return '+237' + p;
}

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
    const existing = await pool.query('SELECT patient_id FROM patients WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);

    // Assign to a hospital BUT NOT to a specific doctor — patient starts as 'pending'
    // Any doctor at the hospital can claim them via the Pending Patients page.
    const hospital = await pool.query('SELECT hospital_id FROM hospitals LIMIT 1');
    const hospitalId = hospital.rows[0]?.hospital_id || null;

    const normalizedPhone = normalizePhone(phone);

    const result = await pool.query(
      `INSERT INTO patients
       (name, email, password_hash, date_of_birth, phone, gender, hospital_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING patient_id, name, email`,
      [name, email, hash, date_of_birth || null, normalizedPhone, gender || null, hospitalId]
    );
    const patient = result.rows[0];

    const token = jwt.sign(
      { patient_id: patient.patient_id, email: patient.email, name: patient.name, role: 'patient' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Send welcome email (fire-and-forget)
    sendWelcomeEmail(patient.email, patient.name);

    // Auto-generate initial ECG analyses in the background
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
      `SELECT p.patient_id, p.name, p.email, p.date_of_birth, p.phone, p.gender, p.profile_picture, p.status,
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

// PUT /api/v1/patient-auth/profile
router.put('/profile', authenticatePatient, upload.single('profile_picture'), async (req, res) => {
  const { name, email, phone, date_of_birth } = req.body;
  const file = req.file;
  let profilePicture = null;

  const normalizedPhone = normalizePhone(phone);

  if (file) {
    const base64 = file.buffer.toString('base64');
    profilePicture = `data:${file.mimetype};base64,${base64}`;
  }

  try {
    const query = profilePicture
      ? `UPDATE patients SET name = $1, email = $2, phone = $3, date_of_birth = $4, profile_picture = $5 WHERE patient_id = $6 RETURNING patient_id, name, email, phone, date_of_birth, gender, profile_picture`
      : `UPDATE patients SET name = $1, email = $2, phone = $3, date_of_birth = $4 WHERE patient_id = $5 RETURNING patient_id, name, email, phone, date_of_birth, gender, profile_picture`;
    const values = profilePicture
      ? [name, email, normalizedPhone, date_of_birth || null, profilePicture, req.patient.patient_id]
      : [name, email, normalizedPhone, date_of_birth || null, req.patient.patient_id];

    const result = await pool.query(query, values);
    res.json({ patient: result.rows[0] });
  } catch (err) {
    console.error('PUT /profile error:', err.message);
    res.status(500).json({ error: 'Failed to update profile', detail: err.message });
  }
});

// POST /api/v1/patient-auth/change-password
router.post('/change-password', authenticatePatient, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }

  try {
    const result = await pool.query('SELECT password_hash FROM patients WHERE patient_id = $1', [req.patient.patient_id]);
    const patient = result.rows[0];
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const valid = await bcrypt.compare(current_password, patient.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE patients SET password_hash = $1 WHERE patient_id = $2', [hash, req.patient.patient_id]);
    res.json({ success: true });
  } catch (err) {
    console.error('POST /change-password error:', err.message);
    res.status(500).json({ error: 'Failed to update password', detail: err.message });
  }
});

module.exports = { router, authenticatePatient };