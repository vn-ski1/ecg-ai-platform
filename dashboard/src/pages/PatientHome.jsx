import { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { colors, shadows, radius, transitions, riskColor } from '../theme';

import { API } from '../config';

export default function PatientHome() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('ecg_patient_token');
    axios.get(`${API}/patient-auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        setData(res.data);
        if (res.data.ecg_records.length > 0) setSelectedRecord(res.data.ecg_records[0]);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || err.message);
        setLoading(false);
      });
  }, []);

  const handleDownloadAll = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const token = localStorage.getItem('ecg_patient_token');
      const res = await axios.get(`${API}/patient-auth/records/all/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
        timeout: 120000,
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ecg-full-history-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      let msg = err.message;
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          const base = json.error || msg;
          msg = json.detail ? `${base}: ${json.detail}` : base;
        } catch (_) {}
      } else if (err.response?.data) {
        const d = err.response.data;
        const base = d.error || msg;
        msg = d.detail ? `${base}: ${d.detail}` : base;
      }
      setDownloadError(msg || t('patient_home.download_error'));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <p style={{ padding: 32, color: colors.textMuted }}>{t('patient_home.loading')}</p>;
  if (error) return <p style={{ padding: 32, color: colors.risk.HIGH }}>{t('patient_home.error')}{error}</p>;
  if (!data) return null;

  const { patient, ecg_records, alerts } = data;
  const latest = ecg_records[0];
  const pendingAlerts = alerts.filter(a => a.status !== 'Resolved');

  const waveformData = selectedRecord
    ? selectedRecord.signal_data.map((v, i) => ({ sample: i, voltage: v }))
    : [];

  const card = {
    background: colors.bgCard,
    padding: 24,
    borderRadius: radius.lg,
    boxShadow: shadows.sm,
    border: `1px solid ${colors.borderLight}`,
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto', background: colors.bg, minHeight: 'calc(100vh - 100px)' }} className="fade-in">
      {/* Welcome card */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, color: colors.accentDark }}>{t('patient_home.hello')} {patient.name}</h2>
            <p style={{ marginTop: 6, color: colors.textMuted, fontSize: 14 }}>
              {patient.email} {patient.phone ? `· ${patient.phone}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
            {latest && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                  {t('patient_home.current_risk')}
                </div>
                <span style={{
                  display: 'inline-block', marginTop: 8,
                  background: riskColor(latest.cvd_risk_category),
                  color: '#fff', padding: '8px 16px', borderRadius: radius.md,
                  fontWeight: 700, fontSize: 18,
                }}>
                  {latest.cvd_risk_category} ({latest.cvd_risk_score}/100)
                </span>
              </div>
            )}
            <button
              onClick={handleDownloadAll}
              disabled={downloading || ecg_records.length === 0}
              title={ecg_records.length === 0 ? t('patient_home.download_no_records') : ''}
              style={{
                background: ecg_records.length === 0 ? colors.bgSubtle : colors.primary,
                color: ecg_records.length === 0 ? colors.textMuted : '#fff',
                border: `1px solid ${ecg_records.length === 0 ? colors.border : colors.primary}`,
                padding: '10px 20px',
                borderRadius: radius.md,
                fontWeight: 600,
                fontSize: 14,
                cursor: ecg_records.length === 0 ? 'not-allowed' : 'pointer',
                transition: transitions.base,
                opacity: downloading ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {downloading ? t('patient_home.download_preparing') : t('patient_home.download_results')}
            </button>
            {downloadError && (
              <div style={{ fontSize: 12, color: colors.risk.HIGH, maxWidth: 220, textAlign: 'right' }}>
                {downloadError}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 24, fontSize: 14 }}>
          <Info label={t('patient_home.dob')} value={patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : '—'} />
          <Info label={t('patient_home.hospital')} value={patient.hospital_name || '—'} />
          <Info label={t('patient_home.assigned_doctor')} value={patient.doctor_name || '—'} sub={patient.doctor_specialty} />
          <Info label={t('patient_home.total_ecgs')} value={ecg_records.length} />
        </div>
      </div>

      {/* Active alerts */}
      {pendingAlerts.length > 0 && (
        <div style={{
          background: `${colors.risk.HIGH}10`,
          borderLeft: `5px solid ${colors.risk.HIGH}`,
          padding: 20,
          borderRadius: radius.md,
          marginTop: 24,
        }}>
          <h3 style={{ margin: 0, color: colors.risk.HIGH }}>⚠ {t('patient_home.active_alerts')} ({pendingAlerts.length})</h3>
          {pendingAlerts.map(a => (
            <div key={a.alert_id} style={{
              marginTop: 12, padding: 12,
              background: colors.bgCard,
              borderRadius: radius.sm,
              border: `1px solid ${colors.borderLight}`,
            }}>
              <div style={{ fontSize: 14, color: colors.text }}>{a.message}</div>
              <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                {new Date(a.created_at).toLocaleString()} · {t('patient_home.doctor_notified')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ECG records & waveform */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ color: colors.text }}>{t('patient_home.your_analyses')}</h3>
        {ecg_records.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', color: colors.textMuted }}>
            {t('patient_home.no_records')}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
            <div style={card}>
              {ecg_records.map(r => (
                <div key={r.record_id}
                  onClick={() => setSelectedRecord(r)}
                  style={{
                    padding: 10, marginBottom: 8, borderRadius: radius.sm, cursor: 'pointer',
                    background: selectedRecord?.record_id === r.record_id ? colors.bgSubtle : 'transparent',
                    borderLeft: `4px solid ${riskColor(r.cvd_risk_category)}`,
                    transition: transitions.base,
                  }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: colors.text }}>Record #{r.record_id}</div>
                  <div style={{ fontSize: 12, color: colors.textMuted }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4, color: colors.text }}>
                    {r.rhythm_class} · <span style={{ color: riskColor(r.cvd_risk_category), fontWeight: 600 }}>
                      {r.cvd_risk_category}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {selectedRecord && (
              <div>
                <div style={card}>
                  <h4 style={{ marginTop: 0, color: colors.text }}>{t('patient_home.analysis')} #{selectedRecord.record_id}</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 14 }}>
                    <Info label={t('patient_home.rhythm')} value={selectedRecord.rhythm_class}
                      sub={`${t('patient_home.confidence')} ${(selectedRecord.confidence * 100).toFixed(1)}%`} />
                    <Info label={t('patient_home.heart_rate')} value={`${Math.round(selectedRecord.bpm || 0)} BPM`} />
                    <Info label={t('patient_home.cvd_score')} value={`${selectedRecord.cvd_risk_score}/100`}
                      sub={selectedRecord.cvd_risk_category} />
                  </div>
                </div>

                <div style={{ ...card, marginTop: 16 }}>
                  <h4 style={{ marginTop: 0, color: colors.text }}>{t('patient_home.ecg_waveform')}</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={waveformData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                      <XAxis dataKey="sample" stroke={colors.textMuted} />
                      <YAxis stroke={colors.textMuted} />
                      <Tooltip contentStyle={{ background: colors.bgCard, border: `1px solid ${colors.border}`, color: colors.text }} />
                      <Line type="monotone" dataKey="voltage" stroke={colors.accentDark} strokeWidth={1.2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value, sub }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4, color: colors.text }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}