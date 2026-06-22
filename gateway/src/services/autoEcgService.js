// Auto-ECG assignment service
// When a patient signs up, generates 2-3 realistic ECG analyses by running
// synthetic waveforms through the real AI service.

const { predictECG } = require('./aiService');
const { sendDiagnosticSMS } = require('./smsService');
const pool = require('../db/pool');

// Build a realistic ECG waveform for each rhythm class
function buildSyntheticECG(rhythmClass) {
  const signal = new Array(360);
  for (let i = 0; i < 360; i++) {
    let v = -0.3 + (Math.random() - 0.5) * 0.04;
    if (i >= 175 && i <= 185) {
      v = rhythmClass === 'PVC' ? -1.8 + (i - 180) * 0.3 : 0.9 - Math.abs(i - 180) * 0.15;
    }
    if (rhythmClass === 'PVC' && i >= 186 && i <= 220) {
      v = 0.7 - (i - 186) * 0.02;
    }
    if (i >= 240 && i <= 270 && rhythmClass !== 'PVC') {
      v = -0.2 + Math.sin((i - 240) / 30 * Math.PI) * 0.15;
    }
    signal[i] = parseFloat(v.toFixed(3));
  }
  return signal;
}

// Pick the BPM that goes with each scenario
const SCENARIOS = [
  { rhythm: 'Normal', bpm: 72 },
  { rhythm: 'Normal', bpm: 78 },
  { rhythm: 'Normal', bpm: 68 },
  { rhythm: 'Normal', bpm: 105 },   // sustained tachy
  { rhythm: 'Normal', bpm: 52 },    // sustained brady
  { rhythm: 'PVC', bpm: 88 },
  { rhythm: 'AFib', bpm: 110 },
];

/**
 * Assign initial ECG records to a freshly-registered patient.
 * Runs in the background — does not block the signup response.
 *
 * @param {number} patientId
 * @param {number} hospitalId
 */
async function autoAssignInitialECGs(patientId, hospitalId) {
  try {
    // 1 Normal, then 1-2 additional varied scenarios
    const normalIdx = Math.floor(Math.random() * 3);
    const additionalCount = Math.random() < 0.5 ? 1 : 2;

    const selectedScenarios = [SCENARIOS[normalIdx]];
    for (let k = 0; k < additionalCount; k++) {
      const idx = 3 + Math.floor(Math.random() * (SCENARIOS.length - 3));
      selectedScenarios.push(SCENARIOS[idx]);
    }

    for (let i = 0; i < selectedScenarios.length; i++) {
      const scenario = selectedScenarios[i];
      const signal = buildSyntheticECG(scenario.rhythm);
      const rrInterval = 60 / scenario.bpm;

      // Backdate the timestamps so older records appear older
      const daysAgo = (selectedScenarios.length - i) * (Math.floor(Math.random() * 5) + 1);
      const recordedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      let aiResult;
      try {
        aiResult = await predictECG(signal, rrInterval);
      } catch (err) {
        console.error(`autoAssignInitialECGs: AI call failed (${err.message}). Skipping this record.`);
        continue;
      }

      // Insert ECG record
      const insertResult = await pool.query(
        `INSERT INTO ecg_records
         (patient_id, hospital_id, recorded_at, signal_data, rr_interval,
          rhythm_class, confidence, cnn_class, bpm, cvd_risk_score, cvd_risk_category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING record_id`,
        [
          patientId, hospitalId, recordedAt,
          JSON.stringify(signal), rrInterval,
          aiResult.rhythm_class, aiResult.confidence,
          aiResult.cnn_class, aiResult.bpm,
          aiResult.cvd_risk_score, aiResult.cvd_risk_category,
        ]
      );
      const recordId = insertResult.rows[0].record_id;

      // If HIGH risk, create the alert too
      if (aiResult.cvd_risk_category === 'HIGH') {
        const doctorRes = await pool.query(
          'SELECT assigned_doctor_id FROM patients WHERE patient_id = $1',
          [patientId]
        );
        const doctorId = doctorRes.rows[0]?.assigned_doctor_id;

        await pool.query(
          `INSERT INTO alerts
           (record_id, patient_id, doctor_id, risk_level, risk_score, rhythm_class, message)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            recordId, patientId, doctorId,
            'HIGH', aiResult.cvd_risk_score, aiResult.rhythm_class,
            `HIGH CVD risk detected: ${aiResult.rhythm_class} (score: ${aiResult.cvd_risk_score})`,
          ]
        );
      }

      // Send diagnostic SMS to the patient (graceful — won't crash if phone is unverified)
      const patientRes = await pool.query(
        'SELECT name, phone FROM patients WHERE patient_id = $1',
        [patientId]
      );
      if (patientRes.rows.length > 0 && patientRes.rows[0].phone) {
        sendDiagnosticSMS(
          patientRes.rows[0].phone,
          patientRes.rows[0].name,
          recordId,
          aiResult.rhythm_class,
          aiResult.cvd_risk_category,
          aiResult.cvd_risk_score
        );
      }
    }

    console.log(`✓ Auto-assigned ${selectedScenarios.length} ECG records to patient ${patientId}`);
  } catch (err) {
    console.error(`autoAssignInitialECGs error for patient ${patientId}: ${err.message}`);
  }
}

module.exports = { autoAssignInitialECGs };