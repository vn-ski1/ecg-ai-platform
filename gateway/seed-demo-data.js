// One-time script to insert realistic demo data into the database
// Creates 5 patients with varied ECG records and risk profiles
const pool = require('./src/db/pool');
require('dotenv').config();

const patients = [
  { name: 'NJIE Marie',         dob: '1955-03-12', phone: '+237677111222', risk: 'HIGH',     rhythm: 'AFib',         bpm: 105, score: 78 },
  { name: 'KAMGA Paul',         dob: '1962-08-25', phone: '+237677333444', risk: 'HIGH',     rhythm: 'PVC',          bpm: 92,  score: 72 },
  { name: 'FOTSO Christine',    dob: '1970-11-04', phone: '+237677555666', risk: 'MODERATE', rhythm: 'Bradycardia',  bpm: 52,  score: 45 },
  { name: 'TCHIENGUE Andre',    dob: '1975-06-18', phone: '+237677777888', risk: 'MODERATE', rhythm: 'Tachycardia',  bpm: 118, score: 52 },
  { name: 'MBALLA Sophie',      dob: '1988-02-09', phone: '+237677999000', risk: 'LOW',      rhythm: 'Normal',       bpm: 72,  score: 12 },
  { name: 'NDONGO Jean-Claude', dob: '1990-09-14', phone: '+237678111333', risk: 'LOW',      rhythm: 'Normal',       bpm: 68,  score: 8  },
];

// Build a realistic-looking 360-sample ECG window mimicking the report's section 5.4 waveform
function buildSyntheticECG(rhythmClass) {
  const signal = new Array(360);
  for (let i = 0; i < 360; i++) {
    // baseline near -0.3 with small noise
    let v = -0.3 + (Math.random() - 0.5) * 0.04;
    // R-peak around sample 180
    if (i >= 175 && i <= 185) {
      v = rhythmClass === 'PVC' ? -1.8 + (i - 180) * 0.3 : 0.9 - Math.abs(i - 180) * 0.15;
    }
    // PVC has wide QRS — broaden the abnormal region
    if (rhythmClass === 'PVC' && i >= 186 && i <= 220) {
      v = 0.7 - (i - 186) * 0.02;
    }
    // T-wave for Normal/Tachy/Brady
    if (i >= 240 && i <= 270 && rhythmClass !== 'PVC') {
      v = -0.2 + Math.sin((i - 240) / 30 * Math.PI) * 0.15;
    }
    signal[i] = parseFloat(v.toFixed(3));
  }
  return signal;
}

async function seed() {
  try {
    // Get the existing hospital and doctor (already created earlier)
    const h = await pool.query('SELECT hospital_id FROM hospitals LIMIT 1');
    const d = await pool.query('SELECT doctor_id FROM doctors LIMIT 1');
    if (h.rows.length === 0 || d.rows.length === 0) {
      console.log('No hospital or doctor in database. Run earlier seed first.');
      pool.end();
      return;
    }
    const hospitalId = h.rows[0].hospital_id;
    const doctorId = d.rows[0].doctor_id;

    for (const p of patients) {
      // Insert patient
      const patientResult = await pool.query(
        `INSERT INTO patients (name, date_of_birth, phone, hospital_id, assigned_doctor_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING patient_id`,
        [p.name, p.dob, p.phone, hospitalId, doctorId]
      );
      const patientId = patientResult.rows[0].patient_id;

      // Insert 1-3 ECG records per patient
      const numRecords = Math.floor(Math.random() * 3) + 1;
      for (let n = 0; n < numRecords; n++) {
        const signal = buildSyntheticECG(p.rhythm);
        const cnnClass = ['Normal', 'AFib', 'PVC'].includes(p.rhythm) ? p.rhythm : 'Normal';
        const confidence = 0.85 + Math.random() * 0.13;
        const rrInterval = 60 / p.bpm;

        // Backdated timestamp so the records look like they happened recently
        const daysAgo = (numRecords - n) * (Math.floor(Math.random() * 3) + 1);
        const recordedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

        const recordResult = await pool.query(
          `INSERT INTO ecg_records
           (patient_id, hospital_id, recorded_at, signal_data, rr_interval,
            rhythm_class, confidence, cnn_class, bpm, cvd_risk_score, cvd_risk_category)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING record_id`,
          [
            patientId, hospitalId, recordedAt,
            JSON.stringify(signal), rrInterval,
            p.rhythm, parseFloat(confidence.toFixed(4)), cnnClass, p.bpm,
            p.score, p.risk
          ]
        );
        const recordId = recordResult.rows[0].record_id;

        // If HIGH risk, create an alert
        if (p.risk === 'HIGH') {
          await pool.query(
            `INSERT INTO alerts
             (record_id, patient_id, doctor_id, risk_level, risk_score, rhythm_class, message)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              recordId, patientId, doctorId, 'HIGH', p.score, p.rhythm,
              `HIGH CVD risk detected: ${p.rhythm} (score: ${p.score})`
            ]
          );
        }
      }
      console.log(`✓ Created patient #${patientId}: ${p.name} (${p.risk})`);
    }

    console.log('\n✓ Demo data seeded successfully.');
    pool.end();
  } catch (err) {
    console.error('Seed error:', err.message);
    pool.end();
  }
}

seed();