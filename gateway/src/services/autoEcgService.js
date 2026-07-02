// Auto-ECG assignment service
// When a patient signs up, generates 1-3 realistic ECG analyses by running
// synthetic waveforms through the real AI service. Sends a diagnostic email
// per result and notifies all doctors at the hospital of the new pending patient.

const { predictECG } = require('./aiService');
const { sendDiagnosticEmail, sendNewPatientNotification, sendHighRiskAlertEmail } = require('./emailService');
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

const SCENARIOS = [
  { rhythm: 'Normal', bpm: 72, weight: 30, riskCategory: 'LOW' },
  { rhythm: 'Normal', bpm: 78, weight: 15, riskCategory: 'LOW' },
  { rhythm: 'Normal', bpm: 68, weight: 15, riskCategory: 'LOW' },
  { rhythm: 'Normal', bpm: 105, weight: 5, riskCategory: 'MODERATE' },   // sustained tachy
  { rhythm: 'Normal', bpm: 52, weight: 5, riskCategory: 'MODERATE' },    // sustained brady
  { rhythm: 'PVC', bpm: 88, weight: 15, riskCategory: 'HIGH' },
  { rhythm: 'AFib', bpm: 110, weight: 15, riskCategory: 'HIGH' },
];

function pickRandomScenario(categories = null) {
  const pool = categories ? SCENARIOS.filter(item => categories.includes(item.riskCategory)) : SCENARIOS;
  if (pool.length === 0) {
    return SCENARIOS[0];
  }

  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  let pick = Math.random() * totalWeight;
  for (const scenario of pool) {
    pick -= scenario.weight;
    if (pick <= 0) return scenario;
  }
  return pool[pool.length - 1];
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function buildScenarioSet(recordCount) {
  if (recordCount === 1) {
    return [pickRandomScenario()];
  }
  if (recordCount === 2) {
    return shuffleArray([
      pickRandomScenario(['LOW']),
      pickRandomScenario(['MODERATE', 'HIGH'])
    ]);
  }
  return shuffleArray([
    pickRandomScenario(['LOW']),
    pickRandomScenario(['MODERATE']),
    pickRandomScenario(['HIGH'])
  ]);
}

/**
 * Assign initial ECG records to a freshly-registered patient.
 * Runs in the background — does not block the signup response.
 *
 * @param {number} patientId
 * @param {number} hospitalId
 */
async function autoAssignInitialECGs(patientId, hospitalId) {
  try {
    const recordCount = Math.floor(Math.random() * 3) + 1;
    const selectedScenarios = buildScenarioSet(recordCount);

    // Fetch patient info once at the start (for emails)
    const patientInfo = await pool.query(
      'SELECT name, email FROM patients WHERE patient_id = $1',
      [patientId]
    );
    const patient = patientInfo.rows[0];

    for (let i = 0; i < selectedScenarios.length; i++) {
      const scenario = selectedScenarios[i];
      const signal = buildSyntheticECG(scenario.rhythm);
      const rrInterval = 60 / scenario.bpm;

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

      // If HIGH risk, create the alert AND email all doctors at the hospital
      if (aiResult.cvd_risk_category === 'HIGH') {
        const doctorRes = await pool.query(
          'SELECT assigned_doctor_id FROM patients WHERE patient_id = $1',
          [patientId]
        );
        const doctorId = doctorRes.rows[0]?.assigned_doctor_id || null;

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

        // Email the assigned doctor (if claimed) OR all doctors at hospital (if still pending)
        const doctorsToEmail = await pool.query(
          doctorId
            ? 'SELECT name, email FROM doctors WHERE doctor_id = $1 AND email IS NOT NULL'
            : 'SELECT name, email FROM doctors WHERE hospital_id = $1 AND email IS NOT NULL',
          [doctorId || hospitalId]
        );
        for (const doc of doctorsToEmail.rows) {
          sendHighRiskAlertEmail(doc.email, doc.name, patient.name, patientId, aiResult);
        }
      }

      // Send diagnostic email to the patient
      if (patient && patient.email) {
        sendDiagnosticEmail(patient.email, patient.name, aiResult);
      }
    }

    console.log(`✓ Auto-assigned ${selectedScenarios.length} ECG records to patient ${patientId}`);

    // Notify all doctors at this hospital that a new patient is awaiting assignment
    if (hospitalId && patient) {
      const doctorsResult = await pool.query(
        'SELECT name, email FROM doctors WHERE hospital_id = $1 AND email IS NOT NULL',
        [hospitalId]
      );
      for (const doctor of doctorsResult.rows) {
        sendNewPatientNotification(doctor.email, doctor.name, patient.name);
      }
      if (doctorsResult.rows.length > 0) {
        console.log(`✓ Notified ${doctorsResult.rows.length} doctor(s) at hospital ${hospitalId} of new patient`);
      }
    }
  } catch (err) {
    console.error(`autoAssignInitialECGs error for patient ${patientId}: ${err.message}`);
  }
}

module.exports = { autoAssignInitialECGs };