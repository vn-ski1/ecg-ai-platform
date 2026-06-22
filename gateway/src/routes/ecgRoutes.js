// Hospital ECG upload endpoint — implements UC2 from your report
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { predictECG } = require('../services/aiService');
const { sendAlertSMS } = require('../services/smsService');
const { authenticateDoctor } = require('./authRoutes');
console.log('ecgRoutes import check:', typeof predictECG, predictECG);
// Middleware: validate hospital API key from header
async function authenticateHospital(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing X-API-Key header' });
  }
  try {
    const result = await pool.query(
      'SELECT hospital_id, hospital_name FROM hospitals WHERE api_key = $1',
      [apiKey]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    req.hospital = result.rows[0];
    next();
  } catch (err) {
    res.status(500).json({ error: 'Authentication failed', detail: err.message });
  }
}

// POST /api/v1/ecg/upload — UC2: Hospital ECG Upload
router.post('/upload', authenticateHospital, async (req, res) => {
  const { patient_id, signal, rr_interval, recorded_at } = req.body;

  // Input validation
  if (!patient_id || !signal || !Array.isArray(signal)) {
    return res.status(400).json({ error: 'patient_id and signal (array) are required' });
  }
  if (signal.length !== 360) {
    return res.status(400).json({ error: `signal must have 360 samples, got ${signal.length}` });
  }

  try {
    // 1. Verify the patient exists and belongs to this hospital
    const patientCheck = await pool.query(
      'SELECT patient_id,name,assigned_doctor_id FROM patients WHERE patient_id = $1 AND hospital_id = $2',
      [patient_id, req.hospital.hospital_id]
    );
    if (patientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found for this hospital' });
    }
    const assignedDoctorId = patientCheck.rows[0].assigned_doctor_id;
    const patientName = patientCheck.rows[0].name;

    // 2. Forward to AI service
    console.log(`→ Forwarding ECG to AI service for patient ${patient_id}`);
    const aiResult = await predictECG(signal, rr_interval);
    console.log(`← AI returned: ${aiResult.rhythm_class} (${aiResult.cvd_risk_category})`);

    // 3. Store ECG record + analysis result
    const insertResult = await pool.query(
      `INSERT INTO ecg_records
       (patient_id, hospital_id, recorded_at, signal_data, rr_interval,
        rhythm_class, confidence, cnn_class, bpm, cvd_risk_score, cvd_risk_category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING record_id`,
      [
        patient_id,
        req.hospital.hospital_id,
        recorded_at || new Date(),
        JSON.stringify(signal),
        rr_interval,
        aiResult.rhythm_class,
        aiResult.confidence,
        aiResult.cnn_class,
        aiResult.bpm,
        aiResult.cvd_risk_score,
        aiResult.cvd_risk_category
      ]
    );
    const recordId = insertResult.rows[0].record_id;

    // 4. If HIGH risk, create an alert record (SMS dispatch will be wired in next phase)
    if (aiResult.cvd_risk_category === 'HIGH') {
      await pool.query(
        `INSERT INTO alerts
         (record_id, patient_id, doctor_id, risk_level, risk_score, rhythm_class, message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          recordId,
          patient_id,
          assignedDoctorId,
          'HIGH',
          aiResult.cvd_risk_score,
          aiResult.rhythm_class,
          `HIGH CVD risk detected: ${aiResult.rhythm_class} (score: ${aiResult.cvd_risk_score})`
        ]
      );
      console.log(`⚠ HIGH risk alert created for patient ${patient_id}`);
      // Dispatch SMS to the doctor's phone via Twilio
      const patientName = patientCheck.rows[0].name || 'Unknown';
      sendAlertSMS(
        process.env.DOCTOR_PHONE_NUMBER,
        patientName,
        aiResult.rhythm_class,
        aiResult.cvd_risk_score
      );
    }

    // 5. Return success
    res.status(202).json({
      status: 'accepted',
      record_id: recordId,
      analysis: aiResult,
      alert_triggered: aiResult.cvd_risk_category === 'HIGH'
    });

  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(500).json({ error: 'Upload processing failed', detail: err.message });
  }
});
// ── GET /patients — list all patients with latest analysis ──
router.get('/patients', authenticateDoctor, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.patient_id,
        p.name,
        p.date_of_birth,
        p.phone,
        h.hospital_name,
        d.name AS doctor_name,
        (SELECT rhythm_class FROM ecg_records er WHERE er.patient_id = p.patient_id ORDER BY er.created_at DESC LIMIT 1) AS latest_rhythm,
        (SELECT cvd_risk_score FROM ecg_records er WHERE er.patient_id = p.patient_id ORDER BY er.created_at DESC LIMIT 1) AS latest_risk_score,
        (SELECT cvd_risk_category FROM ecg_records er WHERE er.patient_id = p.patient_id ORDER BY er.created_at DESC LIMIT 1) AS latest_risk_category,
        (SELECT created_at FROM ecg_records er WHERE er.patient_id = p.patient_id ORDER BY er.created_at DESC LIMIT 1) AS last_ecg_at
      FROM patients p
      LEFT JOIN hospitals h ON h.hospital_id = p.hospital_id
      LEFT JOIN doctors d ON d.doctor_id = p.assigned_doctor_id
      ORDER BY p.patient_id
    `);
    res.json({ patients: result.rows });
  } catch (err) {
    console.error('GET /patients error:', err.message);
    res.status(500).json({ error: 'Failed to fetch patients', detail: err.message });
  }
});

// ── GET /patients/:id — full details for one patient including ECG history ──
router.get('/patients/:id', authenticateDoctor, async (req, res) => {
  const patientId = parseInt(req.params.id, 10);
  if (isNaN(patientId)) {
    return res.status(400).json({ error: 'Invalid patient ID' });
  }
  try {
    const patientResult = await pool.query(`
      SELECT p.*, h.hospital_name, d.name AS doctor_name
      FROM patients p
      LEFT JOIN hospitals h ON h.hospital_id = p.hospital_id
      LEFT JOIN doctors d ON d.doctor_id = p.assigned_doctor_id
      WHERE p.patient_id = $1
    `, [patientId]);

    if (patientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const recordsResult = await pool.query(`
      SELECT record_id, recorded_at, rhythm_class, confidence, cnn_class, bpm,
             cvd_risk_score, cvd_risk_category, signal_data, created_at
      FROM ecg_records
      WHERE patient_id = $1
      ORDER BY created_at DESC
    `, [patientId]);

    res.json({
      patient: patientResult.rows[0],
      ecg_records: recordsResult.rows
    });
  } catch (err) {
    console.error('GET /patients/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch patient', detail: err.message });
  }
});

// ── GET /alerts — list all active alerts ──
router.get('/alerts', authenticateDoctor, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, p.name AS patient_name, d.name AS doctor_name
      FROM alerts a
      LEFT JOIN patients p ON p.patient_id = a.patient_id
      LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
      ORDER BY a.created_at DESC
    `);
    res.json({ alerts: result.rows });
  } catch (err) {
    console.error('GET /alerts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch alerts', detail: err.message });
  }
});
// PATCH /alerts/:id/acknowledge — mark an alert as resolved
router.patch('/alerts/:id/acknowledge', authenticateDoctor, async (req, res) => {
  const alertId = parseInt(req.params.id, 10);
  if (isNaN(alertId)) {
    return res.status(400).json({ error: 'Invalid alert ID' });
  }
  try {
    const result = await pool.query(
      `UPDATE alerts SET status = 'Resolved', resolved_at = NOW()
       WHERE alert_id = $1 RETURNING alert_id, status, resolved_at`,
      [alertId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ ok: true, alert: result.rows[0] });
  } catch (err) {
    console.error('Acknowledge error:', err.message);
    res.status(500).json({ error: 'Failed to acknowledge alert', detail: err.message });
  }
});
module.exports = router;