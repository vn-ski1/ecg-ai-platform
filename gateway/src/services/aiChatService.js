const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_HISTORY = 8;

let client = null;
const apiKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim();
if (apiKey && apiKey !== 'your-key-here') {
  try {
    client = new GoogleGenAI({ apiKey });
    console.log('✓ AI chat service initialized (Gemini, model:', MODEL, ')');
  } catch (err) {
    console.warn('[aiChatService] Gemini client initialization failed:', err.message);
  }
} else {
  console.warn('[aiChatService] GEMINI_API_KEY not set — AI chat will use a fallback explanation until a key is added to .env');
}

// ── Signal feature computation ──────────────────────────────────────────────

function computeSignalFeatures(signalData) {
  if (!Array.isArray(signalData) || signalData.length === 0) {
    return { signal_mean: null, signal_std: null, signal_min: null, signal_max: null, irregularity_count: null, rr_std: null };
  }

  const n = signalData.length;
  const mean = signalData.reduce((s, v) => s + v, 0) / n;
  const variance = signalData.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const min = Math.min(...signalData);
  const max = Math.max(...signalData);

  const irregularity_count = signalData.filter(v => Math.abs(v - mean) > 2 * std).length;

  const sorted = [...signalData].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(n * 0.9)];

  const peaks = [];
  for (let i = 1; i < n - 1; i++) {
    if (
      signalData[i] > p90 &&
      signalData[i] >= signalData[i - 1] &&
      signalData[i] >= signalData[i + 1] &&
      (peaks.length === 0 || i - peaks[peaks.length - 1] > 20)
    ) {
      peaks.push(i);
    }
  }

  let rr_std = null;
  if (peaks.length >= 3) {
    const msIntervals = [];
    for (let i = 1; i < peaks.length; i++) {
      msIntervals.push(((peaks[i] - peaks[i - 1]) / 360) * 1000);
    }
    const iMean = msIntervals.reduce((s, v) => s + v, 0) / msIntervals.length;
    const iVar = msIntervals.reduce((s, v) => s + (v - iMean) ** 2, 0) / msIntervals.length;
    rr_std = Math.round(Math.sqrt(iVar));
  }

  return {
    signal_mean: Math.round(mean * 1000) / 1000,
    signal_std: Math.round(std * 1000) / 1000,
    signal_min: Math.round(min * 1000) / 1000,
    signal_max: Math.round(max * 1000) / 1000,
    irregularity_count,
    rr_std,
  };
}

// ── Main export ─────────────────────────────────────────────────────────────

function buildFallbackReply(ecgContext, doctorQuestion, features) {
  const { patient, ecg } = ecgContext;
  const { signal_mean, signal_std, signal_min, signal_max, irregularity_count, rr_std } = features;
  const rrStr = rr_std !== null
    ? `${rr_std} ms`
    : 'not reliably measurable from this 360-sample segment';
  const confidencePct = ecg.confidence != null
    ? `${(ecg.confidence * 100).toFixed(1)}%`
    : '—';

  const questionText = doctorQuestion && doctorQuestion.trim()
    ? `The doctor asked: ${doctorQuestion.trim()}`
    : 'The doctor requested an explanation of the ECG analysis.';

  return [
    `${questionText}`,
    `I’m currently using a fallback explanation because the Gemini chat service is unavailable. For record #${ecg.record_id}, the ECG classifier reported ${ecg.rhythm_class || 'the recorded rhythm'} with ${confidencePct} confidence.`,
    `Patient ${patient.name || '—'} has a heart rate of ${ecg.bpm != null ? Math.round(ecg.bpm) : '—'} BPM and a cardiovascular risk of ${ecg.cvd_risk_category || '—'} (${ecg.cvd_risk_score != null ? ecg.cvd_risk_score : '—'}/100).`,
    `The computed signal features are mean=${signal_mean}, std=${signal_std}, min=${signal_min}, max=${signal_max}, irregularity_count=${irregularity_count}, and RR variability=${rrStr}. Please use this summary together with your clinical judgment.`,
    '⚕️ This explanation is educational — clinical decisions remain your judgment.',
  ].join(' ');
}

async function askAboutECG(ecgContext, doctorQuestion, conversationHistory = []) {
  const { patient, ecg } = ecgContext;

  let signalData = ecg.signal_data;
  if (typeof signalData === 'string') {
    try { signalData = JSON.parse(signalData); } catch (_) { signalData = []; }
  }

  const features = computeSignalFeatures(Array.isArray(signalData) ? signalData : []);

  if (!client) {
    return {
      reply: buildFallbackReply(ecgContext, doctorQuestion, features),
      computed_features: features,
      fallback: true,
    };
  }

  try {
    const { signal_mean, signal_std, signal_min, signal_max, irregularity_count, rr_std } = features;

    const rrStr = rr_std !== null
      ? `${rr_std} ms`
      : 'not reliably measurable from this 360-sample segment';

    const confidencePct = ecg.confidence != null
      ? `${(ecg.confidence * 100).toFixed(1)}%`
      : '—';

    const isFirstMessage = conversationHistory.filter(m => m.role === 'assistant').length === 0;

    const systemPrompt = `You are an AI assistant helping a cardiologist understand the output of a 1D-CNN ECG classifier. You must ground every explanation in the actual numbers provided below. Never invent data. Never claim to have re-analyzed the signal beyond what is stated in the ECG context. You are speaking on behalf of the CNN — explain its decisions clearly and educationally, but always remind the doctor that the CNN outputs a probability, not a diagnosis, and that clinical judgment remains their responsibility.

Respond in the same language as the doctor's question (English or French). Keep responses concise (3-5 short paragraphs max). If asked something outside cardiology or ECG interpretation, politely redirect. If the doctor asks 'why' a classification was made, explain in terms of: (1) the CNN's confidence score and what it means, (2) the computed signal features provided, (3) the general clinical pattern associated with that rhythm class.

ECG CONTEXT FOR THIS CONVERSATION:
Patient: ${patient.name || '—'}, DOB: ${patient.date_of_birth || '—'}, Gender: ${patient.gender || '—'}.
Recording: ID #${ecg.record_id}, recorded at ${ecg.recorded_at || '—'}.
CNN classification: ${ecg.rhythm_class} with ${confidencePct} confidence.
Heart rate: ${ecg.bpm != null ? Math.round(ecg.bpm) : '—'} BPM.
Cardiovascular risk: ${ecg.cvd_risk_category} (score ${ecg.cvd_risk_score}/100).
Computed signal features from the 360-sample recording: mean=${signal_mean}, std=${signal_std}, min=${signal_min}, max=${signal_max}, irregularity_count=${irregularity_count} samples exceeding 2 sigma, RR variability=${rrStr}.${isFirstMessage ? '\n\nEnd your first response with this exact medical disclaimer on a new line: "⚕️ This explanation is educational — clinical decisions remain your judgment."' : ''}`;

    const limitedHistory = conversationHistory.slice(-MAX_HISTORY);

    const geminiContents = [
      ...limitedHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })),
      { role: 'user', parts: [{ text: doctorQuestion }] },
    ];

    const response = await client.models.generateContent({
      model: MODEL,
      contents: geminiContents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.4,
        maxOutputTokens: 800,
      },
    });

    const replyText = response.text || (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) || '';

    return {
      reply: replyText,
      computed_features: features,
    };
  } catch (err) {
    console.warn('[aiChatService] Gemini request failed, using fallback reply:', err.message);
    return {
      reply: buildFallbackReply(ecgContext, doctorQuestion, features),
      computed_features: features,
      fallback: true,
    };
  }
}

module.exports = { askAboutECG };