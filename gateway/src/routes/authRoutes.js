const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const pool = require('../db/pool');
const { sendDoctorWelcomeEmail } = require('../services/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret-do-not-use-in-production';
const JWT_EXPIRES_IN = '8h';
const upload = multer({ storage: multer.memoryStorage() });

pool.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS profile_picture TEXT').catch(() => {});


// POST /api/v1/auth/signup — doctor self-signup with hospital invite code
router.post('/signup', async (req, res) => {
  const { name, email, password, specialty, phone, hospital_code } = req.body;

  if (!name || !email || !password || !hospital_code) {
    return res.status(400).json({ error: 'Name, email, password, and hospital code are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const hospitalResult = await pool.query(
      'SELECT hospital_id, hospital_name FROM hospitals WHERE signup_code = $1',
      [hospital_code]
    );
    if (hospitalResult.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid hospital invite code. Please contact your hospital administration.' });
    }
    const hospital = hospitalResult.rows[0];

    const existing = await pool.query('SELECT doctor_id FROM doctors WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO doctors (name, email, password_hash, specialty, phone, hospital_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING doctor_id, name, email, specialty`,
      [name, email, hash, specialty || 'Cardiologie', phone || null, hospital.hospital_id]
    );
    const doctor = result.rows[0];

    const token = jwt.sign(
      { doctor_id: doctor.doctor_id, email: doctor.email, name: doctor.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log(`✓ New doctor registered: ${doctor.name} (${doctor.email}) at ${hospital.hospital_name}`);

    // Send welcome email (fire-and-forget)
    sendDoctorWelcomeEmail(doctor.email, doctor.name, hospital.hospital_name);

    res.status(201).json({
      token,
      doctor: {
        doctor_id: doctor.doctor_id,
        name: doctor.name,
        email: doctor.email,
        specialty: doctor.specialty,
      },
    });
  } catch (err) {
    console.error('Doctor signup error:', err.message);
    res.status(500).json({ error: 'Signup failed', detail: err.message });
  }
});


// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT doctor_id, name, email, specialty, password_hash FROM doctors WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const doctor = result.rows[0];

    const valid = await bcrypt.compare(password, doctor.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      {
        doctor_id: doctor.doctor_id,
        email: doctor.email,
        name: doctor.name
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token: token,
      doctor: {
        doctor_id: doctor.doctor_id,
        name: doctor.name,
        email: doctor.email,
        specialty: doctor.specialty
      }
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
});


function authenticateDoctor(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.doctor = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}


router.get('/me', authenticateDoctor, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT doctor_id, name, email, specialty, profile_picture FROM doctors WHERE doctor_id = $1',
      [req.doctor.doctor_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Doctor not found' });
    res.json({ doctor: result.rows[0] });
  } catch (err) {
    console.error('GET /me error:', err.message);
    res.status(500).json({ error: 'Failed to fetch doctor data', detail: err.message });
  }
});


router.put('/profile', authenticateDoctor, upload.single('profile_picture'), async (req, res) => {
  const { name, email, specialty } = req.body;
  const file = req.file;
  let profilePicture = null;

  if (file) {
    const base64 = file.buffer.toString('base64');
    profilePicture = `data:${file.mimetype};base64,${base64}`;
  }

  try {
    const result = await pool.query(
      `UPDATE doctors SET name = $1, email = $2, specialty = $3${profilePicture ? ', profile_picture = $4' : ''} WHERE doctor_id = $5 RETURNING doctor_id, name, email, specialty, profile_picture`,
      profilePicture ? [name, email, specialty, profilePicture, req.doctor.doctor_id] : [name, email, specialty, req.doctor.doctor_id]
    );
    res.json({ doctor: result.rows[0] });
  } catch (err) {
    console.error('PUT /profile error:', err.message);
    res.status(500).json({ error: 'Failed to update profile', detail: err.message });
  }
});


router.post('/change-password', authenticateDoctor, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }

  try {
    const result = await pool.query('SELECT password_hash FROM doctors WHERE doctor_id = $1', [req.doctor.doctor_id]);
    const doctor = result.rows[0];
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    const valid = await bcrypt.compare(current_password, doctor.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE doctors SET password_hash = $1 WHERE doctor_id = $2', [hash, req.doctor.doctor_id]);
    res.json({ success: true });
  } catch (err) {
    console.error('POST /change-password error:', err.message);
    res.status(500).json({ error: 'Failed to update password', detail: err.message });
  }
});

module.exports = { router, authenticateDoctor };
