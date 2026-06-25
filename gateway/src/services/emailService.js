const nodemailer = require('nodemailer');

const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true';
const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;

let transporter = null;

if (EMAIL_ENABLED && EMAIL_USER && EMAIL_PASSWORD) {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: EMAIL_USER, pass: EMAIL_PASSWORD },
  });
  console.log('✓ Email service initialized');
} else {
  console.log('⚠ Email service disabled (set EMAIL_ENABLED=true in .env to enable)');
}

// ─── Public API ──────────────────────────────────────────────────────────

async function sendWelcomeEmail(toEmail, patientName) {
  if (!transporter || !toEmail) return;
  try {
    const info = await transporter.sendMail({
      from: `"ECG AI Platform" <${EMAIL_FROM}>`,
      to: toEmail,
      subject: 'Welcome to ECG AI Platform / Bienvenue sur ECG AI Platform',
      html: welcomeTemplate(patientName),
    });
    console.log(`✓ [welcome-email] sent to ${toEmail}: ${info.messageId}`);
  } catch (err) {
    console.error(`✗ [welcome-email] failed for ${toEmail}: ${err.message}`);
  }
}

async function sendDiagnosticEmail(toEmail, patientName, ecg) {
  if (!transporter || !toEmail) return;
  try {
    const info = await transporter.sendMail({
      from: `"ECG AI Platform" <${EMAIL_FROM}>`,
      to: toEmail,
      subject: subjectForRisk(ecg.cvd_risk_category),
      html: diagnosticTemplate(patientName, ecg),
    });
    console.log(`✓ [diagnostic-email] sent to ${toEmail}: ${info.messageId}`);
  } catch (err) {
    console.error(`✗ [diagnostic-email] failed for ${toEmail}: ${err.message}`);
  }
}

async function sendNewPatientNotification(doctorEmail, doctorName, patientName) {
  if (!transporter || !doctorEmail) return;
  try {
    const info = await transporter.sendMail({
      from: `"ECG AI Platform" <${EMAIL_FROM}>`,
      to: doctorEmail,
      subject: 'New Patient Request · ECG AI Platform',
      html: newPatientNotificationTemplate(doctorName, patientName),
    });
    console.log(`✓ [new-patient-email] sent to ${doctorEmail}: ${info.messageId}`);
  } catch (err) {
    console.error(`✗ [new-patient-email] failed for ${doctorEmail}: ${err.message}`);
  }
}

async function sendDoctorWelcomeEmail(toEmail, doctorName, hospitalName) {
  if (!transporter || !toEmail) return;
  try {
    const info = await transporter.sendMail({
      from: `"ECG AI Platform" <${EMAIL_FROM}>`,
      to: toEmail,
      subject: 'Welcome, Doctor · ECG AI Platform',
      html: doctorWelcomeTemplate(doctorName, hospitalName),
    });
    console.log(`✓ [doctor-welcome-email] sent to ${toEmail}: ${info.messageId}`);
  } catch (err) {
    console.error(`✗ [doctor-welcome-email] failed for ${toEmail}: ${err.message}`);
  }
}

async function sendHighRiskAlertEmail(doctorEmail, doctorName, patientName, patientId, ecg) {
  if (!transporter || !doctorEmail) return;
  try {
    const info = await transporter.sendMail({
      from: `"ECG AI Platform" <${EMAIL_FROM}>`,
      to: doctorEmail,
      subject: `🚨 URGENT: HIGH cardiac risk detected — ${patientName}`,
      html: highRiskAlertTemplate(doctorName, patientName, patientId, ecg),
    });
    console.log(`✓ [high-risk-alert] sent to ${doctorEmail}: ${info.messageId}`);
  } catch (err) {
    console.error(`✗ [high-risk-alert] failed for ${doctorEmail}: ${err.message}`);
  }
}

// ─── Subject line helpers ───────────────────────────────────────────────

function subjectForRisk(category) {
  if (category === 'HIGH') return '⚠ Important: Your ECG result requires attention / Votre résultat ECG nécessite une attention';
  if (category === 'MODERATE') return 'Your ECG result — please review / Votre résultat ECG — à examiner';
  return 'Good news: Your ECG result is normal / Bonne nouvelle : Votre résultat ECG est normal';
}

// ─── Patient-friendly explanation helpers ───────────────────────────────

function rhythmExplanation(rhythmClass, lang = 'en') {
  const map = {
    en: {
      Normal: 'A normal heart rhythm — this is what we want to see.',
      AFib: 'Atrial fibrillation — an irregular heart rhythm that should be evaluated by a cardiologist.',
      PVC: 'Premature ventricular contractions — extra heartbeats that occur earlier than expected. Often benign but worth discussing with your doctor.',
      Tachycardia: 'A faster than normal heartbeat. May be temporary or require investigation.',
      Bradycardia: 'A slower than normal heartbeat. May be normal for athletic individuals or require investigation.',
    },
    fr: {
      Normal: 'Un rythme cardiaque normal — c\'est ce que nous voulons voir.',
      AFib: 'Fibrillation auriculaire — un rythme cardiaque irrégulier qui doit être évalué par un cardiologue.',
      PVC: 'Extrasystoles ventriculaires — des battements supplémentaires qui surviennent plus tôt que prévu. Souvent bénin mais à discuter avec votre médecin.',
      Tachycardia: 'Un battement cardiaque plus rapide que la normale. Peut être temporaire ou nécessiter des examens.',
      Bradycardia: 'Un battement cardiaque plus lent que la normale. Peut être normal pour les sportifs ou nécessiter des examens.',
    },
  };
  return map[lang][rhythmClass] || (lang === 'en' ? 'An unusual rhythm pattern.' : 'Un rythme inhabituel.');
}

function verdictBlock(ecg, lang = 'en') {
  const cat = ecg.cvd_risk_category;
  if (lang === 'en') {
    if (cat === 'HIGH') {
      return {
        title: '⚠ Important: please contact your doctor as soon as possible',
        color: '#e63946',
        text: 'Your ECG analysis suggests an elevated cardiovascular risk. This is not a diagnosis, but our AI system has flagged something that warrants prompt medical attention. <strong>Your assigned cardiologist has been notified automatically</strong> and will reach out to you. In the meantime, avoid intense physical exertion and contact your doctor or local emergency services if you experience symptoms like chest pain, severe shortness of breath, or fainting.',
      };
    }
    if (cat === 'MODERATE') {
      return {
        title: 'Your result needs attention',
        color: '#f59e0b',
        text: 'Your ECG analysis shows a moderate cardiovascular risk. This is not an emergency, but it is something worth discussing with your doctor at your next appointment. Continue with your usual activities and maintain a healthy lifestyle — balanced diet, moderate exercise, no smoking — until you can review the result together with a cardiologist.',
      };
    }
    return {
      title: 'Good news: your result looks reassuring',
      color: '#10b981',
      text: 'Your ECG analysis shows a low cardiovascular risk. No specific action is required from your side. Continue with your healthy habits, and feel free to schedule routine follow-ups with your doctor.',
    };
  }
  // French
  if (cat === 'HIGH') {
    return {
      title: '⚠ Important : veuillez contacter votre médecin dès que possible',
      color: '#e63946',
      text: 'Votre analyse ECG suggère un risque cardiovasculaire élevé. Ce n\'est pas un diagnostic, mais notre système IA a détecté un signal qui mérite une attention médicale rapide. <strong>Votre cardiologue assigné a été notifié automatiquement</strong> et prendra contact avec vous. En attendant, évitez tout effort physique intense et contactez votre médecin ou les services d\'urgence en cas de symptômes comme douleur thoracique, essoufflement important ou évanouissement.',
    };
  }
  if (cat === 'MODERATE') {
    return {
      title: 'Votre résultat nécessite une attention',
      color: '#f59e0b',
      text: 'Votre analyse ECG montre un risque cardiovasculaire modéré. Ce n\'est pas une urgence, mais cela mérite d\'être discuté avec votre médecin lors de votre prochain rendez-vous. Continuez vos activités habituelles et maintenez un mode de vie sain — alimentation équilibrée, exercice modéré, pas de tabac — jusqu\'à ce que vous puissiez examiner le résultat avec un cardiologue.',
    };
  }
  return {
    title: 'Bonne nouvelle : votre résultat est rassurant',
    color: '#10b981',
    text: 'Votre analyse ECG montre un risque cardiovasculaire faible. Aucune action particulière n\'est requise de votre part. Continuez vos bonnes habitudes et n\'hésitez pas à programmer des suivis de routine avec votre médecin.',
  };
}

// ─── HTML templates ──────────────────────────────────────────────────────

const FOOTER = `
  <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
    ECG AI Platform · IUC B.Tech Final Project · Douala, Cameroon
  </div>
`;

const HEADER = (subtitle) => `
  <div style="background: linear-gradient(135deg, #0d4f5c 0%, #073640 100%); padding: 30px; color: white;">
    <h1 style="margin: 0; font-size: 22px;">ECG AI Platform</h1>
    <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.85;">${subtitle}</p>
  </div>
`;

function welcomeTemplate(patientName) {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; background: #f1f5f9; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden;">
    ${HEADER('Welcome / Bienvenue')}
    <div style="padding: 30px;">
      <h2 style="color: #0d4f5c; margin-top: 0;">Welcome, ${patientName}!</h2>
      <p>Thank you for joining the <strong>ECG AI Platform</strong>. Your account is now active.</p>
      <p>Over the next few minutes, our AI system will process your initial cardiac analyses. <strong>You will receive a separate email for each ECG result</strong>, with a clear explanation of what it means and what (if anything) you should do.</p>
      <p>A cardiologist from your hospital will also review your file and become your assigned doctor.</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="http://localhost:5173/patient/login" style="background: #0d4f5c; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">View My Dashboard</a>
      </p>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">

      <h2 style="color: #0d4f5c;">Bienvenue, ${patientName} !</h2>
      <p>Merci d'avoir rejoint la plateforme <strong>ECG AI Platform</strong>. Votre compte est maintenant actif.</p>
      <p>Dans les prochaines minutes, notre système IA va traiter vos premières analyses cardiaques. <strong>Vous recevrez un e-mail séparé pour chaque résultat ECG</strong>, avec une explication claire de ce qu'il signifie et de ce que vous devez faire (s'il y a lieu).</p>
      <p>Un cardiologue de votre hôpital examinera également votre dossier et deviendra votre médecin assigné.</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="http://localhost:5173/patient/login" style="background: #0d4f5c; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">Voir mon tableau de bord</a>
      </p>
    </div>
    ${FOOTER}
  </div>
</body></html>
  `.trim();
}

function diagnosticTemplate(patientName, ecg) {
  const verdictEN = verdictBlock(ecg, 'en');
  const verdictFR = verdictBlock(ecg, 'fr');
  const rhythmEN = rhythmExplanation(ecg.rhythm_class, 'en');
  const rhythmFR = rhythmExplanation(ecg.rhythm_class, 'fr');

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; background: #f1f5f9; padding: 20px; margin: 0;">
  <div style="max-width: 620px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden;">
    ${HEADER('Cardiac Analysis Result / Résultat d\'analyse cardiaque')}
    <div style="padding: 30px;">

      <!-- ENGLISH SECTION -->
      <p>Dear ${patientName},</p>
      <p>Your ECG analysis has been processed by our AI system. Here is the result, with a plain-language explanation below.</p>

      <div style="background: ${verdictEN.color}; color: white; padding: 18px; border-radius: 6px; margin: 20px 0;">
        <div style="font-weight: 700; font-size: 16px; margin-bottom: 8px;">${verdictEN.title}</div>
        <div style="font-size: 14px; line-height: 1.5;">${verdictEN.text}</div>
      </div>

      <h3 style="color: #0d4f5c; margin-top: 24px; margin-bottom: 8px;">What we measured</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 10px 12px; background: #f8fafc; font-weight: 600; border: 1px solid #e2e8f0; width: 40%;">Heart rhythm</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${ecg.rhythm_class}<br><span style="color: #64748b; font-size: 13px;">${rhythmEN}</span></td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: #f8fafc; font-weight: 600; border: 1px solid #e2e8f0;">Heart rate</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${Math.round(ecg.bpm || 0)} BPM <span style="color: #64748b; font-size: 13px;">(beats per minute — normal is 60–100)</span></td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: #f8fafc; font-weight: 600; border: 1px solid #e2e8f0;">Cardiovascular risk score</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${ecg.cvd_risk_score}/100 <span style="color: #64748b; font-size: 13px;">(category: ${ecg.cvd_risk_category})</span></td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: #f8fafc; font-weight: 600; border: 1px solid #e2e8f0;">AI confidence</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${(ecg.confidence * 100).toFixed(1)}%</td>
        </tr>
      </table>

      <p style="text-align: center; margin: 28px 0;">
        <a href="http://localhost:5173/patient/login" style="background: #0d4f5c; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Full Report</a>
      </p>

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">

      <!-- FRENCH SECTION -->
      <p>Cher/Chère ${patientName},</p>
      <p>Votre analyse ECG a été traitée par notre système IA. Voici le résultat, avec une explication en langage simple ci-dessous.</p>

      <div style="background: ${verdictFR.color}; color: white; padding: 18px; border-radius: 6px; margin: 20px 0;">
        <div style="font-weight: 700; font-size: 16px; margin-bottom: 8px;">${verdictFR.title}</div>
        <div style="font-size: 14px; line-height: 1.5;">${verdictFR.text}</div>
      </div>

      <h3 style="color: #0d4f5c; margin-top: 24px; margin-bottom: 8px;">Ce que nous avons mesuré</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 10px 12px; background: #f8fafc; font-weight: 600; border: 1px solid #e2e8f0; width: 40%;">Rythme cardiaque</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${ecg.rhythm_class}<br><span style="color: #64748b; font-size: 13px;">${rhythmFR}</span></td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: #f8fafc; font-weight: 600; border: 1px solid #e2e8f0;">Fréquence cardiaque</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${Math.round(ecg.bpm || 0)} BPM <span style="color: #64748b; font-size: 13px;">(battements par minute — normal : 60–100)</span></td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: #f8fafc; font-weight: 600; border: 1px solid #e2e8f0;">Score de risque cardiovasculaire</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${ecg.cvd_risk_score}/100 <span style="color: #64748b; font-size: 13px;">(catégorie : ${ecg.cvd_risk_category})</span></td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: #f8fafc; font-weight: 600; border: 1px solid #e2e8f0;">Confiance de l'IA</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${(ecg.confidence * 100).toFixed(1)}%</td>
        </tr>
      </table>

      <p style="text-align: center; margin: 28px 0;">
        <a href="http://localhost:5173/patient/login" style="background: #0d4f5c; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">Voir le rapport complet</a>
      </p>

      <p style="font-size: 12px; color: #64748b; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
        <strong>Important / Important :</strong> This analysis is generated by an AI-assisted decision support system and is <strong>not a medical diagnosis</strong>. Treatment decisions remain the responsibility of your physician. — Cette analyse est générée par un système d'aide à la décision assisté par IA et <strong>n'est pas un diagnostic médical</strong>. Les décisions de traitement relèvent de la responsabilité de votre médecin.
      </p>
    </div>
    ${FOOTER}
  </div>
</body></html>
  `.trim();
}

function newPatientNotificationTemplate(doctorName, patientName) {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; background: #f1f5f9; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden;">
    ${HEADER('New Patient Request')}
    <div style="padding: 30px;">
      <p>Dear Dr. ${doctorName},</p>
      <p>A new patient has registered on the platform: <strong>${patientName}</strong></p>
      <p>You can review their initial ECG analyses and choose to take them on as your patient. Note: other doctors in your hospital can also see this request — the first to claim becomes the assigned doctor.</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="http://localhost:5173/pending-patients" style="background: #0d4f5c; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Pending Patients</a>
      </p>
    </div>
    ${FOOTER}
  </div>
</body></html>
  `.trim();
}

function doctorWelcomeTemplate(doctorName, hospitalName) {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; background: #f1f5f9; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden;">
    ${HEADER('Welcome, Doctor')}
    <div style="padding: 30px;">
      <h2 style="color: #0d4f5c; margin-top: 0;">Welcome, Dr. ${doctorName}!</h2>
      <p>Your doctor account has been successfully created on the <strong>ECG AI Platform</strong>, with affiliation to <strong>${hospitalName}</strong>.</p>
      <p>You can now:</p>
      <ul>
        <li>View pending patient requests from your hospital and claim patients</li>
        <li>Review AI-analyzed ECG results for your assigned patients</li>
        <li>Receive automatic alerts when one of your patients has a HIGH cardiovascular risk</li>
        <li>Download printable PDF medical reports for any ECG record</li>
      </ul>
      <p style="text-align: center; margin: 28px 0;">
        <a href="http://localhost:5173/login" style="background: #0d4f5c; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">Open My Dashboard</a>
      </p>
      <p style="font-size: 13px; color: #64748b;">Use the email and password you set during signup to log in.</p>
    </div>
    ${FOOTER}
  </div>
</body></html>
  `.trim();
}

function highRiskAlertTemplate(doctorName, patientName, patientId, ecg) {
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; background: #f1f5f9; padding: 20px; margin: 0;">
  <div style="max-width: 620px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden;">
    <div style="background: #e63946; padding: 24px; color: white;">
      <div style="font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.9;">URGENT ALERT</div>
      <h1 style="margin: 6px 0 0 0; font-size: 22px;">HIGH cardiac risk detected</h1>
    </div>
    <div style="padding: 30px;">
      <p>Dear Dr. ${doctorName},</p>
      <p>An ECG analysis for one of your patients has been flagged as <strong>HIGH cardiovascular risk</strong> by our AI system. Your prompt review is recommended.</p>

      <h3 style="color: #0d4f5c; margin-top: 24px;">Patient details</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 10px 12px; background: #f8fafc; font-weight: 600; border: 1px solid #e2e8f0; width: 40%;">Patient name</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${patientName}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: #f8fafc; font-weight: 600; border: 1px solid #e2e8f0;">Patient ID</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0;">#${patientId}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: #f8fafc; font-weight: 600; border: 1px solid #e2e8f0;">Detected rhythm</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${ecg.rhythm_class}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: #f8fafc; font-weight: 600; border: 1px solid #e2e8f0;">Heart rate</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${Math.round(ecg.bpm || 0)} BPM</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: #f8fafc; font-weight: 600; border: 1px solid #e2e8f0;">CVD risk score</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0; color: #e63946; font-weight: 700;">${ecg.cvd_risk_score}/100 (HIGH)</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: #f8fafc; font-weight: 600; border: 1px solid #e2e8f0;">AI confidence</td>
          <td style="padding: 10px 12px; border: 1px solid #e2e8f0;">${(ecg.confidence * 100).toFixed(1)}%</td>
        </tr>
      </table>

      <p style="text-align: center; margin: 28px 0;">
        <a href="http://localhost:5173/patients/${patientId}" style="background: #e63946; color: white; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 15px;">Review Patient Now</a>
      </p>

      <p style="font-size: 12px; color: #64748b; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
        This alert was generated by an AI-assisted decision support system and is not a diagnosis. Clinical judgment and treatment decisions remain your responsibility.
      </p>
    </div>
    ${FOOTER}
  </div>
</body></html>
  `.trim();
}

module.exports = {
  sendWelcomeEmail,
  sendDiagnosticEmail,
  sendNewPatientNotification,
  sendDoctorWelcomeEmail,
  sendHighRiskAlertEmail,
};