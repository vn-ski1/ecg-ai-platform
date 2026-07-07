import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { colors, shadows, radius, transitions, riskColor } from '../theme';

const API = `http://${window.location.hostname}:3000/api/v1/ecg`;

export default function PatientDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Chat state ────────────────────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [signalFeatures, setSignalFeatures] = useState(null);
  const chatBottomRef = useRef(null);

  // Reset chat whenever the doctor selects a different record
  useEffect(() => {
    setChatOpen(false);
    setChatMessages([]);
    setChatInput('');
    setChatError(null);
    setSignalFeatures(null);
  }, [selectedRecord?.record_id]);

  // Auto-scroll chat thread to the latest message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    const token = localStorage.getItem('ecg_token');
    axios.get(`${API}/patients/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        setPatient(res.data.patient);
        setRecords(res.data.ecg_records);
        if (res.data.ecg_records.length > 0) setSelectedRecord(res.data.ecg_records[0]);
        setLoading(false);
      })
      .catch(err => {
        console.error('API Error:', err);
        setError(err.response?.data?.error || err.message);
        setLoading(false);
      });
  }, [id]);

  const handleSendMessage = async (questionOverride) => {
    const question = (typeof questionOverride === 'string' ? questionOverride : chatInput).trim();
    if (!question || chatLoading || !selectedRecord) return;

    const token = localStorage.getItem('ecg_token');
    const userMsg = { role: 'user', content: question };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    setChatError(null);

    try {
      const res = await axios.post(
        `${API}/records/${selectedRecord.record_id}/chat`,
        { question, history: chatMessages },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setChatMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
      if (res.data.computed_features && !signalFeatures) {
        setSignalFeatures(res.data.computed_features);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setChatError(msg);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) return <p style={{ color: colors.textMuted }}>{t('patient_detail.loading')}</p>;
  if (error) return <p style={{ color: colors.risk.HIGH }}>{t('patient_detail.error')}{error}</p>;
  if (!patient) return <p style={{ color: colors.textMuted }}>{t('patient_detail.not_found')}</p>;

  const waveformData = selectedRecord
    ? selectedRecord.signal_data.map((v, i) => ({ sample: i, voltage: v }))
    : [];

  const card = {
    background: colors.bgCard,
    padding: 20,
    borderRadius: radius.lg,
    boxShadow: shadows.sm,
    border: `1px solid ${colors.borderLight}`,
  };

  const suggestedQuestions = selectedRecord ? [
    t('patient_detail.chat_q1', { rhythm: selectedRecord.rhythm_class }),
    t('patient_detail.chat_q2', { score: selectedRecord.cvd_risk_score }),
    t('patient_detail.chat_q3', { bpm: selectedRecord.bpm ? Math.round(selectedRecord.bpm) : '?' }),
    t('patient_detail.chat_q4'),
  ] : [];

  return (
    <div className="fade-in">
      <Link to="/patients" style={{ color: colors.primary, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>{t('patient_detail.back')}</Link>

      <div style={{ ...card, marginTop: 16 }}>
        <h2 style={{ marginTop: 0, color: colors.text }}>{patient.name}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, fontSize: 14, color: colors.text }}>
          <div><b style={{ color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('patient_detail.dob')}</b><br/>{patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : '—'}</div>
          <div><b style={{ color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('patient_detail.phone')}</b><br/>{patient.phone || '—'}</div>
          <div><b style={{ color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('patient_detail.hospital')}</b><br/>{patient.hospital_name || '—'}</div>
          <div><b style={{ color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('patient_detail.assigned_doctor')}</b><br/>{patient.doctor_name || '—'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, marginTop: 16 }}>
        {/* Left: record list */}
        <div style={card}>
          <h3 style={{ marginTop: 0, color: colors.text }}>{t('patient_detail.ecg_history')} ({records.length})</h3>
          {records.length === 0 && <p style={{ color: colors.textMuted }}>{t('patient_detail.no_records')}</p>}
          {records.map(r => (
            <div key={r.record_id}
              onClick={() => setSelectedRecord(r)}
              style={{
                padding: 10, marginBottom: 8, borderRadius: radius.sm, cursor: 'pointer',
                background: selectedRecord?.record_id === r.record_id ? colors.bgSubtle : 'transparent',
                borderLeft: `4px solid ${riskColor(r.cvd_risk_category)}`,
                transition: transitions.base,
              }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: colors.text }}>Record #{r.record_id}</div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>{new Date(r.created_at).toLocaleString()}</div>
              <div style={{ fontSize: 12, marginTop: 4, color: colors.text }}>
                {r.rhythm_class} · <span style={{ color: riskColor(r.cvd_risk_category), fontWeight: 600 }}>{r.cvd_risk_category}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Right: analysis + chat + waveform */}
        <div>
          {selectedRecord && (
            <>
              {/* AI Analysis card */}
              <div style={card}>
                <h3 style={{ marginTop: 0, color: colors.text }}>{t('patient_detail.ai_analysis')} #{selectedRecord.record_id}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 14 }}>
                  <div>
                    <div style={{ color: colors.textMuted, fontSize: 12 }}>{t('patient_detail.rhythm_classification')}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: colors.text }}>{selectedRecord.rhythm_class}</div>
                    <div style={{ fontSize: 12, color: colors.textMuted }}>{t('patient_detail.cnn_confidence')} {(selectedRecord.confidence * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div style={{ color: colors.textMuted, fontSize: 12 }}>{t('patient_detail.heart_rate')}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: colors.text }}>{selectedRecord.bpm ? `${selectedRecord.bpm.toFixed(0)} BPM` : '—'}</div>
                  </div>
                  <div>
                    <div style={{ color: colors.textMuted, fontSize: 12 }}>{t('patient_detail.cvd_risk')}</div>
                    <div style={{
                      display: 'inline-block', padding: '4px 12px', borderRadius: radius.sm,
                      background: riskColor(selectedRecord.cvd_risk_category),
                      color: '#fff', fontWeight: 600, fontSize: 14,
                    }}>
                      {selectedRecord.cvd_risk_category} ({selectedRecord.cvd_risk_score}/100)
                    </div>
                  </div>
                </div>
              </div>

              {/* ── AI Chat panel ─────────────────────────────────────── */}
              <div style={{ ...card, marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0, color: colors.text, fontSize: 15 }}>
                    {t('patient_detail.chat_title')}
                  </h3>
                  <button
                    onClick={() => setChatOpen(o => !o)}
                    style={{
                      background: chatOpen ? colors.bgSubtle : colors.primary,
                      color: chatOpen ? colors.text : '#fff',
                      border: `1px solid ${chatOpen ? colors.border : colors.primary}`,
                      borderRadius: radius.sm,
                      padding: '6px 14px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: transitions.base,
                    }}
                  >
                    {chatOpen ? t('patient_detail.chat_collapse') : t('patient_detail.chat_open')}
                  </button>
                </div>

                {chatOpen && (
                  <div style={{ marginTop: 14 }}>
                    {/* Signal features badge — shown after first AI response */}
                    {signalFeatures && (
                      <div style={{
                        fontSize: 11, color: colors.textMuted,
                        background: colors.bgSubtle,
                        border: `1px solid ${colors.borderLight}`,
                        padding: '5px 10px', borderRadius: radius.sm,
                        marginBottom: 12, fontFamily: 'monospace',
                      }}>
                        {t('patient_detail.chat_features')}:
                        {' '}σ={signalFeatures.signal_std}
                        {' '}· irreg={signalFeatures.irregularity_count}
                        {' '}· RR-std={signalFeatures.rr_std != null ? `${signalFeatures.rr_std}ms` : '—'}
                      </div>
                    )}

                    {/* Suggested questions (only shown before first message) */}
                    {chatMessages.length === 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>
                          {t('patient_detail.chat_suggestions')}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {suggestedQuestions.map((q, i) => (
                            <button
                              key={i}
                              onClick={() => handleSendMessage(q)}
                              style={{
                                background: colors.bgSubtle,
                                border: `1px solid ${colors.borderLight}`,
                                borderRadius: radius.full,
                                padding: '5px 12px',
                                fontSize: 12,
                                color: colors.primary,
                                cursor: 'pointer',
                                transition: transitions.base,
                              }}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Chat thread */}
                    {chatMessages.length > 0 && (
                      <div style={{
                        maxHeight: 340,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        marginBottom: 12,
                        padding: '4px 0',
                      }}>
                        {chatMessages.map((msg, i) => (
                          <div key={i} style={{
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '80%',
                          }}>
                            <div style={{
                              background: msg.role === 'user' ? colors.primary : colors.bgSubtle,
                              color: msg.role === 'user' ? '#fff' : colors.text,
                              padding: '9px 14px',
                              borderRadius: msg.role === 'user'
                                ? `${radius.md}px ${radius.md}px 4px ${radius.md}px`
                                : `${radius.md}px ${radius.md}px ${radius.md}px 4px`,
                              fontSize: 13,
                              lineHeight: 1.55,
                              whiteSpace: 'pre-wrap',
                              border: msg.role === 'assistant' ? `1px solid ${colors.borderLight}` : 'none',
                            }}>
                              {msg.content}
                            </div>
                          </div>
                        ))}

                        {/* Typing indicator */}
                        {chatLoading && (
                          <div style={{ alignSelf: 'flex-start' }}>
                            <div style={{
                              background: colors.bgSubtle,
                              border: `1px solid ${colors.borderLight}`,
                              borderRadius: `${radius.md}px ${radius.md}px ${radius.md}px 4px`,
                              padding: '9px 14px',
                              display: 'flex',
                              gap: 4,
                              alignItems: 'center',
                            }}>
                              {[0, 1, 2].map(d => (
                                <div key={d} style={{
                                  width: 7, height: 7,
                                  borderRadius: '50%',
                                  background: colors.textMuted,
                                  animation: `pulse 1.2s ease-in-out ${d * 0.2}s infinite`,
                                }} />
                              ))}
                            </div>
                          </div>
                        )}

                        <div ref={chatBottomRef} />
                      </div>
                    )}

                    {/* Error message */}
                    {chatError && (
                      <div style={{ fontSize: 12, color: colors.risk?.HIGH || '#ef4444', marginBottom: 8 }}>
                        {t('patient_detail.chat_error')}: {chatError}
                      </div>
                    )}

                    {/* Input row */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                        placeholder={t('patient_detail.chat_placeholder')}
                        disabled={chatLoading}
                        style={{
                          flex: 1,
                          padding: '9px 14px',
                          borderRadius: radius.md,
                          border: `1px solid ${colors.borderLight}`,
                          background: colors.bgSubtle,
                          color: colors.text,
                          fontSize: 13,
                          outline: 'none',
                        }}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={chatLoading || !chatInput.trim()}
                        style={{
                          background: chatLoading || !chatInput.trim() ? colors.bgSubtle : colors.primary,
                          color: chatLoading || !chatInput.trim() ? colors.textMuted : '#fff',
                          border: `1px solid ${chatLoading || !chatInput.trim() ? colors.border : colors.primary}`,
                          borderRadius: radius.md,
                          padding: '9px 18px',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer',
                          transition: transitions.base,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {chatLoading ? '...' : t('patient_detail.chat_send')}
                      </button>
                    </div>

                    <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
                      {t('patient_detail.chat_disclaimer')}
                    </div>
                  </div>
                )}
              </div>

              {/* ECG Waveform card */}
              <div style={{ ...card, marginTop: 16 }}>
                <h3 style={{ marginTop: 0, color: colors.text }}>{t('patient_detail.ecg_waveform')}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={waveformData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                    <XAxis dataKey="sample" stroke={colors.textMuted} label={{ value: 'Sample', position: 'insideBottom', offset: -5, fill: colors.textMuted }} />
                    <YAxis stroke={colors.textMuted} label={{ value: 'Voltage (mV)', angle: -90, position: 'insideLeft', fill: colors.textMuted }} />
                    <Tooltip contentStyle={{ background: colors.bgCard, border: `1px solid ${colors.border}`, color: colors.text }} />
                    <Line type="monotone" dataKey="voltage" stroke={colors.primary} strokeWidth={1.2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
                <p style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>
                  {t('patient_detail.waveform_caption')}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
