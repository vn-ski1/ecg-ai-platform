import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { colors, shadows, radius, transitions, riskColor } from '../theme';

const API = 'http://localhost:3000/api/v1/ecg';

export default function PatientDetail() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API}/patients/${id}`)
      .then(res => {
        setPatient(res.data.patient);
        setRecords(res.data.ecg_records);
        if (res.data.ecg_records.length > 0) setSelectedRecord(res.data.ecg_records[0]);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [id]);

  if (loading) return <p style={{ color: colors.textMuted }}>Loading patient details...</p>;
  if (error) return <p style={{ color: colors.risk.HIGH }}>Error: {error}</p>;
  if (!patient) return <p style={{ color: colors.textMuted }}>Patient not found.</p>;

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

  return (
    <div className="fade-in">
      <Link to="/patients" style={{ color: colors.primary, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>← Back to patients</Link>

      <div style={{ ...card, marginTop: 16 }}>
        <h2 style={{ marginTop: 0, color: colors.text }}>{patient.name}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, fontSize: 14, color: colors.text }}>
          <div><b style={{ color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Date of Birth</b><br/>{patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : '—'}</div>
          <div><b style={{ color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Phone</b><br/>{patient.phone || '—'}</div>
          <div><b style={{ color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Hospital</b><br/>{patient.hospital_name || '—'}</div>
          <div><b style={{ color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Assigned Doctor</b><br/>{patient.doctor_name || '—'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, marginTop: 16 }}>
        <div style={card}>
          <h3 style={{ marginTop: 0, color: colors.text }}>ECG History ({records.length})</h3>
          {records.length === 0 && <p style={{ color: colors.textMuted }}>No ECG records yet.</p>}
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

        <div>
          {selectedRecord && (
            <>
              <div style={card}>
                <h3 style={{ marginTop: 0, color: colors.text }}>AI Analysis — Record #{selectedRecord.record_id}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 14 }}>
                  <div>
                    <div style={{ color: colors.textMuted, fontSize: 12 }}>Rhythm Classification</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: colors.text }}>{selectedRecord.rhythm_class}</div>
                    <div style={{ fontSize: 12, color: colors.textMuted }}>CNN confidence: {(selectedRecord.confidence * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div style={{ color: colors.textMuted, fontSize: 12 }}>Heart Rate</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: colors.text }}>{selectedRecord.bpm ? `${selectedRecord.bpm.toFixed(0)} BPM` : '—'}</div>
                  </div>
                  <div>
                    <div style={{ color: colors.textMuted, fontSize: 12 }}>CVD Risk</div>
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

              <div style={{ ...card, marginTop: 16 }}>
                <h3 style={{ marginTop: 0, color: colors.text }}>ECG Waveform</h3>
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
                  360 samples · sampling rate 360 Hz · MIT-BIH style heartbeat window
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}