// Hospital ECG upload endpoint — implements UC2 from your report
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { predictECG } = require('../services/aiService');
const { sendAlertSMS } = require('../services/smsService');
const { sendHighRiskAlertEmail } = require('../services/emailService');
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

  if (!patient_id || !signal || !Array.isArray(signal)) {
    return res.status(400).json({ error: 'patient_id and signal (array) are required' });
  }
  if (signal.length !== 360) {
    return res.status(400).json({ error: `signal must have 360 samples, got ${signal.length}` });
  }

  try {
    const patientCheck = await pool.query(
      'SELECT patient_id,name,assigned_doctor_id FROM patients WHERE patient_id = $1 AND hospital_id = $2',
      [patient_id, req.hospital.hospital_id]
    );
    if (patientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found for this hospital' });
    }
    const assignedDoctorId = patientCheck.rows[0].assigned_doctor_id;
    const patientName = patientCheck.rows[0].name;

    console.log(`→ Forwarding ECG to AI service for patient ${patient_id}`);
    const aiResult = await predictECG(signal, rr_interval);
    console.log(`← AI returned: ${aiResult.rhythm_class} (${aiResult.cvd_risk_category})`);

    const insertResult = await pool.query(
      `INSERT INTO ecg_records
       (patient_id, hospital_id, recorded_at, signal_data, rr_interval,
        rhythm_class, confidence, cnn_class, bpm, cvd_risk_score, cvd_risk_category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING record_id`,
      [
        patient_id, req.hospital.hospital_id, recorded_at || new Date(),
        JSON.stringify(signal), rr_interval,
        aiResult.rhythm_class, aiResult.confidence, aiResult.cnn_class,
        aiResult.bpm, aiResult.cvd_risk_score, aiResult.cvd_risk_category
      ]
    );
    const recordId = insertResult.rows[0].record_id;

   if (aiResult.cvd_risk_category === 'HIGH') {
      await pool.query(
        `INSERT INTO alerts
         (record_id, patient_id, doctor_id, risk_level, risk_score, rhythm_class, message)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          recordId, patient_id, assignedDoctorId,
          'HIGH', aiResult.cvd_risk_score, aiResult.rhythm_class,
          `HIGH CVD risk detected: ${aiResult.rhythm_class} (score: ${aiResult.cvd_risk_score})`
        ]
      );
      console.log(`⚠ HIGH risk alert created for patient ${patient_id}`);

      // Email the assigned doctor about the HIGH risk
      if (assignedDoctorId) {
        const doctorRes = await pool.query(
          'SELECT name, email FROM doctors WHERE doctor_id = $1 AND email IS NOT NULL',
          [assignedDoctorId]
        );
        if (doctorRes.rows.length > 0) {
          sendHighRiskAlertEmail(
            doctorRes.rows[0].email,
            doctorRes.rows[0].name,
            patientName,
            patient_id,
            aiResult
          );
        }
      }
    }

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

// ── GET /patients — list patients ASSIGNED to the logged-in doctor ──
router.get('/patients', authenticateDoctor, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.patient_id,
        p.name,
        p.date_of_birth,
        p.phone,
        p.status,
        h.hospital_name,
        d.name AS doctor_name,
        (SELECT rhythm_class FROM ecg_records er WHERE er.patient_id = p.patient_id ORDER BY er.created_at DESC LIMIT 1) AS latest_rhythm,
        (SELECT cvd_risk_score FROM ecg_records er WHERE er.patient_id = p.patient_id ORDER BY er.created_at DESC LIMIT 1) AS latest_risk_score,
        (SELECT cvd_risk_category FROM ecg_records er WHERE er.patient_id = p.patient_id ORDER BY er.created_at DESC LIMIT 1) AS latest_risk_category,
        (SELECT created_at FROM ecg_records er WHERE er.patient_id = p.patient_id ORDER BY er.created_at DESC LIMIT 1) AS last_ecg_at
      FROM patients p
      LEFT JOIN hospitals h ON h.hospital_id = p.hospital_id
      LEFT JOIN doctors d ON d.doctor_id = p.assigned_doctor_id
      WHERE p.assigned_doctor_id = $1
      ORDER BY p.patient_id
    `, [req.doctor.doctor_id]);
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

// ── GET /alerts — list all active alerts for THIS doctor's patients ──
router.get('/alerts', authenticateDoctor, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, p.name AS patient_name, d.name AS doctor_name
      FROM alerts a
      LEFT JOIN patients p ON p.patient_id = a.patient_id
      LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
      WHERE a.doctor_id = $1
      ORDER BY a.created_at DESC
    `, [req.doctor.doctor_id]);
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


// ─────────────────────────────────────────────────────────────────────────
// NEW: Pending patient claim system
// ─────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/ecg/pending-patients
 * List all unassigned patients in the logged-in doctor's hospital.
 * Returns the patient + their latest ECG so doctors can evaluate before claiming.
 */
router.get('/pending-patients', authenticateDoctor, async (req, res) => {
  try {
    // Look up the doctor's hospital first
    const doctorResult = await pool.query(
      'SELECT hospital_id FROM doctors WHERE doctor_id = $1',
      [req.doctor.doctor_id]
    );
    if (doctorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor record not found' });
    }
    const hospitalId = doctorResult.rows[0].hospital_id;

    const result = await pool.query(`
      SELECT
        p.patient_id,
        p.name,
        p.email,
        p.date_of_birth,
        p.phone,
        p.gender,
        p.status,
        p.created_at AS signup_date,
        (SELECT COUNT(*) FROM ecg_records WHERE patient_id = p.patient_id) AS ecg_count,
        (SELECT rhythm_class FROM ecg_records er WHERE er.patient_id = p.patient_id ORDER BY er.created_at DESC LIMIT 1) AS latest_rhythm,
        (SELECT cvd_risk_category FROM ecg_records er WHERE er.patient_id = p.patient_id ORDER BY er.created_at DESC LIMIT 1) AS latest_risk_category,
        (SELECT cvd_risk_score FROM ecg_records er WHERE er.patient_id = p.patient_id ORDER BY er.created_at DESC LIMIT 1) AS latest_risk_score
      FROM patients p
      WHERE p.hospital_id = $1
        AND (p.status = 'pending' OR p.assigned_doctor_id IS NULL)
      ORDER BY p.created_at DESC
    `, [hospitalId]);
    res.json({ patients: result.rows });
  } catch (err) {
    console.error('GET /pending-patients error:', err.message);
    res.status(500).json({ error: 'Failed to fetch pending patients', detail: err.message });
  }
});


/**
 * POST /api/v1/ecg/claim-patient/:id
 * Atomically claim a pending patient. Uses a conditional UPDATE so two doctors
 * clicking at the same time produce a clear winner — the second doctor gets 409.
 */
router.post('/claim-patient/:id', authenticateDoctor, async (req, res) => {
  const patientId = parseInt(req.params.id, 10);
  if (isNaN(patientId)) {
    return res.status(400).json({ error: 'Invalid patient ID' });
  }

  try {
    // Verify the doctor and patient are at the same hospital before claiming
    const doctorResult = await pool.query(
      'SELECT hospital_id, name FROM doctors WHERE doctor_id = $1',
      [req.doctor.doctor_id]
    );
    if (doctorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor record not found' });
    }
    const doctorHospitalId = doctorResult.rows[0].hospital_id;

    // Atomic claim: only succeeds if the patient is in the same hospital
    // AND has no assigned doctor yet
    const claimResult = await pool.query(
      `UPDATE patients
       SET assigned_doctor_id = $1, status = 'assigned'
       WHERE patient_id = $2
         AND hospital_id = $3
         AND (assigned_doctor_id IS NULL OR status = 'pending')
       RETURNING patient_id, name, email`,
      [req.doctor.doctor_id, patientId, doctorHospitalId]
    );

    if (claimResult.rows.length === 0) {
      // Either patient doesn't exist, isn't in this hospital, or already claimed by someone else
      return res.status(409).json({
        error: 'This patient has already been claimed by another doctor or is not available in your hospital.'
      });
    }

    // Also update any existing alerts to point to the new doctor
    await pool.query(
      'UPDATE alerts SET doctor_id = $1 WHERE patient_id = $2 AND doctor_id IS NULL',
      [req.doctor.doctor_id, patientId]
    );

    const claimedPatient = claimResult.rows[0];
    console.log(`✓ Dr. ${doctorResult.rows[0].name} claimed patient #${patientId} (${claimedPatient.name})`);

    res.json({
      ok: true,
      patient: claimedPatient,
      message: `You are now the assigned doctor for ${claimedPatient.name}.`
    });
  } catch (err) {
    console.error('POST /claim-patient error:', err.message);
    res.status(500).json({ error: 'Failed to claim patient', detail: err.message });
  }
});

// POST /api/v1/ecg/records/:recordId/chat — AI chat about a specific ECG record
router.post('/records/:recordId/chat', authenticateDoctor, async (req, res) => {
  const recordId = parseInt(req.params.recordId, 10);
  if (isNaN(recordId)) {
    return res.status(400).json({ error: 'Invalid record ID' });
  }

  const { question, history } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }

  try {
    // Enforce doctor ownership: only the assigned doctor can chat about this record
    const recordResult = await pool.query(
      `SELECT r.record_id, r.recorded_at, r.rhythm_class, r.confidence, r.bpm,
              r.cvd_risk_score, r.cvd_risk_category, r.signal_data,
              p.name AS patient_name, p.date_of_birth, p.gender
       FROM ecg_records r
       JOIN patients p ON p.patient_id = r.patient_id
       WHERE r.record_id = $1
         AND p.assigned_doctor_id = $2`,
      [recordId, req.doctor.doctor_id]
    );

    if (recordResult.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found or you are not the assigned doctor' });
    }

    const row = recordResult.rows[0];
    const ecgContext = {
      patient: {
        name: row.patient_name,
        date_of_birth: row.date_of_birth,
        gender: row.gender,
      },
      ecg: {
        record_id: row.record_id,
        recorded_at: row.recorded_at,
        rhythm_class: row.rhythm_class,
        confidence: row.confidence,
        bpm: row.bpm,
        cvd_risk_score: row.cvd_risk_score,
        cvd_risk_category: row.cvd_risk_category,
        signal_data: typeof row.signal_data === 'string' ? JSON.parse(row.signal_data) : row.signal_data,
      },
    };

    const { askAboutECG } = require('../services/aiChatService');
    const result = await askAboutECG(ecgContext, question.trim(), Array.isArray(history) ? history : []);

    if (result.error) {
      return res.status(503).json({ error: result.error, detail: result.detail });
    }

    res.json({ reply: result.reply, computed_features: result.computed_features });
  } catch (err) {
    console.error('POST /records/:id/chat error:', err.message);
    res.status(500).json({ error: 'Chat request failed', detail: err.message });
  }
});

module.exports = router;