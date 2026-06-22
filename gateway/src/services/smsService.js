// SMS dispatcher via Twilio — supports doctor alerts, patient welcome, and patient diagnostic SMS
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;
const enabled = process.env.PATIENT_SMS_ENABLED !== 'false';  // default ON

let client = null;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
} else {
  console.warn('Twilio credentials missing in .env — SMS dispatch will be skipped.');
}

// ── Generic send helper with graceful failure ───────────────────────
async function sendSMS(toNumber, message, kind = 'sms') {
  if (!client) {
    console.log(`[${kind}] skipped (no Twilio client). Would have sent to ${toNumber}:`);
    console.log('   ' + message.replace(/\n/g, '\n   '));
    return null;
  }
  if (!toNumber) {
    console.log(`[${kind}] skipped (no recipient phone number).`);
    return null;
  }

  try {
    const sms = await client.messages.create({
      body: message,
      from: fromNumber,
      to: toNumber,
    });
    console.log(`✓ [${kind}] dispatched to ${toNumber} — SID: ${sms.sid}`);
    return sms.sid;
  } catch (err) {
    // Trial Twilio numbers can only SMS verified caller IDs.
    // Don't crash the signup — just log and move on.
    if (err.code === 21608 || err.message.includes('unverified')) {
      console.log(`[${kind}] skipped — ${toNumber} not verified (Twilio trial limitation). Message intended:`);
      console.log('   ' + message.replace(/\n/g, '\n   '));
      return null;
    }
    console.error(`✗ [${kind}] dispatch failed: ${err.message}`);
    return null;
  }
}

// ── DOCTOR HIGH risk alert (existing) ───────────────────────────────
async function sendAlertSMS(toNumber, patientName, rhythmClass, riskScore) {
  const message =
    `ECG ALERT — HIGH cardiovascular risk detected. ` +
    `Patient: ${patientName}. Rhythm: ${rhythmClass}. CVD risk score: ${riskScore}/100. ` +
    `Please review immediately in the doctor dashboard.`;
  return sendSMS(toNumber, message, 'doctor-alert');
}

// ── PATIENT welcome SMS ─────────────────────────────────────────────
async function sendWelcomeSMS(toNumber, patientName) {
  if (!enabled) {
    console.log('[welcome] patient SMS disabled via PATIENT_SMS_ENABLED.');
    return null;
  }
  const message =
    `Welcome to ECG AI Platform, ${patientName}! Your account is active. ` +
    `Your first cardiac analyses will be available in your dashboard shortly. ` +
    `Thanks for using our app :)\n\n` +
    `--- Bienvenue sur ECG AI Platform, ${patientName} ! Votre compte est actif. ` +
    `Vos premières analyses cardiaques seront disponibles bientôt sur votre tableau de bord. ` +
    `Merci d'utiliser notre application :)`;
  return sendSMS(toNumber, message, 'welcome');
}

// ── PATIENT diagnostic SMS (LOW / MODERATE / HIGH) ──────────────────
async function sendDiagnosticSMS(toNumber, patientName, recordId, rhythmClass, riskCategory, riskScore) {
  if (!enabled) {
    console.log('[diagnostic] patient SMS disabled via PATIENT_SMS_ENABLED.');
    return null;
  }

  let messageEN, messageFR;

  if (riskCategory === 'HIGH') {
    messageEN =
      `URGENT: ${patientName}, your latest ECG analysis (Record #${recordId}) indicates a HIGH cardiovascular risk ` +
      `(${rhythmClass}, score ${riskScore}/100). Please contact your doctor or visit the hospital as soon as possible. ` +
      `Your physician has also been notified. Thanks for using our app :)`;
    messageFR =
      `URGENT : ${patientName}, votre dernière analyse ECG (Enregistrement #${recordId}) indique un risque cardiovasculaire ÉLEVÉ ` +
      `(${rhythmClass}, score ${riskScore}/100). Veuillez contacter votre médecin ou vous rendre à l'hôpital dès que possible. ` +
      `Votre médecin a également été notifié. Merci d'utiliser notre application :)`;
  } else if (riskCategory === 'MODERATE') {
    messageEN =
      `${patientName}, your latest ECG analysis (Record #${recordId}) indicates a MODERATE cardiovascular risk ` +
      `(${rhythmClass}, score ${riskScore}/100). We recommend scheduling a consultation with your assigned doctor. ` +
      `Login to your dashboard for details. Thanks for using our app :)`;
    messageFR =
      `${patientName}, votre dernière analyse ECG (Enregistrement #${recordId}) indique un risque cardiovasculaire MODÉRÉ ` +
      `(${rhythmClass}, score ${riskScore}/100). Nous vous recommandons de prendre rendez-vous avec votre médecin. ` +
      `Connectez-vous à votre tableau de bord pour plus de détails. Merci d'utiliser notre application :)`;
  } else {
    // LOW
    messageEN =
      `${patientName}, your latest ECG analysis (Record #${recordId}) was classified as ${rhythmClass} by our AI. ` +
      `CVD risk: LOW. This is not a medical diagnosis — please confirm with your doctor at your next visit. ` +
      `Thanks for using our app :)`;
    messageFR =
      `${patientName}, votre dernière analyse ECG (Enregistrement #${recordId}) a été classée comme ${rhythmClass} par notre IA. ` +
      `Risque cardiovasculaire : FAIBLE. Ceci n'est pas un diagnostic médical — veuillez confirmer avec votre médecin lors de votre prochaine visite. ` +
      `Merci d'utiliser notre application :)`;
  }

  const message = `${messageEN}\n\n--- ${messageFR}`;
  return sendSMS(toNumber, message, `diagnostic-${riskCategory}`);
}

module.exports = { sendAlertSMS, sendWelcomeSMS, sendDiagnosticSMS };