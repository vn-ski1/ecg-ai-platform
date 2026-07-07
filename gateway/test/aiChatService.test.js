const test = require('node:test');
const assert = require('node:assert/strict');

process.env.GEMINI_API_KEY = '';
const { askAboutECG } = require('../src/services/aiChatService');

test('returns a helpful fallback reply when Gemini is unavailable', async () => {

  const ecgContext = {
    patient: { name: 'Test Patient', date_of_birth: '1990-01-01', gender: 'F' },
    ecg: {
      record_id: 7,
      recorded_at: '2026-07-04T12:00:00Z',
      rhythm_class: 'Normal sinus rhythm',
      confidence: 0.91,
      bpm: 76,
      cvd_risk_score: 18,
      cvd_risk_category: 'Low',
      signal_data: Array.from({ length: 360 }, (_, i) => Math.sin(i / 20) + 0.1 * Math.sin(i / 5)),
    },
  };

  const result = await askAboutECG(ecgContext, 'Pourquoi ce tracé a-t-il été classé ainsi ?', []);

  assert.equal(typeof result.reply, 'string');
  assert.ok(result.reply.length > 0);
  assert.ok(result.computed_features);
});
