import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { colors, shadows, radius, transitions, riskColor } from '../theme';

const API = 'http://localhost:3000/api/v1/ecg';

export default function PendingPatients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [claimingId, setClaimingId] = useState(null);
  const [message, setMessage] = useState(null);

  const fetchPending = () => {
    setLoading(true);
    axios.get(`${API}/pending-patients`)
      .then(res => { setPatients(res.data.patients); setLoading(false); })
      .catch(err => { setError(err.response?.data?.error || err.message); setLoading(false); });
  };

  useEffect(() => { fetchPending(); }, []);

  const claimPatient = async (patientId, patientName) => {
    if (!window.confirm(`Take on ${patientName} as your patient? This action is permanent.`)) return;
    setClaimingId(patientId);
    setMessage(null);
    try {
      const res = await axios.post(`${API}/claim-patient/${patientId}`);
      setMessage({ type: 'success', text: res.data.message });
      // Refresh the list — the claimed patient should disappear
      fetchPending();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || err.message });
    } finally {
      setClaimingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: colors.textMuted }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
        Loading pending patient requests...
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', background: '#fef2f2', color: colors.risk.HIGH, borderRadius: radius.md }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: colors.text }}>Pending Patient Requests</h2>
        <p style={{ color: colors.textMuted, fontSize: 14, marginTop: 6 }}>
          New patients awaiting a doctor at your hospital. Click "Accept" to become their assigned cardiologist.
          <br />
          <span style={{ fontSize: 12, color: colors.textLight }}>
            ⚡ First doctor to click wins — once claimed, the patient is permanently yours.
          </span>
        </p>
      </div>

      {message && (
        <div style={{
          padding: 14,
          marginBottom: 20,
          background: message.type === 'success' ? `${colors.risk.LOW}15` : `${colors.risk.HIGH}15`,
          color: message.type === 'success' ? colors.risk.LOW : colors.risk.HIGH,
          border: `1px solid ${message.type === 'success' ? colors.risk.LOW : colors.risk.HIGH}30`,
          borderRadius: radius.md,
          fontSize: 14,
          fontWeight: 500,
        }}>
          {message.type === 'success' ? '✓ ' : '✗ '}{message.text}
        </div>
      )}

      {patients.length === 0 ? (
        <div style={{
          background: colors.bgCard,
          padding: 60,
          borderRadius: radius.lg,
          boxShadow: shadows.sm,
          border: `1px solid ${colors.borderLight}`,
          textAlign: 'center',
          color: colors.textMuted,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: colors.text, marginBottom: 4 }}>
            No pending requests right now
          </div>
          <div style={{ fontSize: 13 }}>
            All patients at your hospital are assigned to a doctor. Check back later.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
          {patients.map(p => (
            <PatientCard
              key={p.patient_id}
              patient={p}
              onClaim={() => claimPatient(p.patient_id, p.name)}
              claiming={claimingId === p.patient_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PatientCard({ patient, onClaim, claiming }) {
  const riskCol = patient.latest_risk_category ? riskColor(patient.latest_risk_category) : colors.textMuted;
  const dob = patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : '—';
  const signupDate = patient.signup_date ? new Date(patient.signup_date).toLocaleDateString() : '—';

  return (
    <div style={{
      background: colors.bgCard,
      borderRadius: radius.lg,
      boxShadow: shadows.sm,
      border: `1px solid ${colors.borderLight}`,
      borderLeft: `4px solid ${riskCol}`,
      padding: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: colors.text }}>{patient.name}</div>
          <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            ID #{patient.patient_id} · Registered {signupDate}
          </div>
        </div>
        {patient.latest_risk_category && (
          <span style={{
            background: `${riskCol}15`,
            color: riskCol,
            padding: '4px 10px',
            borderRadius: radius.full,
            fontSize: 12,
            fontWeight: 700,
            border: `1px solid ${riskCol}30`,
          }}>
            {patient.latest_risk_category}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16, fontSize: 13 }}>
        <Detail label="Date of Birth" value={dob} />
        <Detail label="Gender" value={patient.gender || '—'} />
        <Detail label="Email" value={patient.email || '—'} />
        <Detail label="Phone" value={patient.phone || '—'} />
      </div>

      <div style={{
        marginTop: 14,
        paddingTop: 14,
        borderTop: `1px solid ${colors.borderLight}`,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 12,
        fontSize: 13,
      }}>
        <Detail label="ECG records" value={patient.ecg_count || '0'} />
        <Detail label="Latest rhythm" value={patient.latest_rhythm || '—'} />
        <Detail label="CVD score" value={patient.latest_risk_score ? `${patient.latest_risk_score}/100` : '—'} />
      </div>

      <button
        onClick={onClaim}
        disabled={claiming}
        style={{
          marginTop: 18,
          width: '100%',
          padding: 12,
          background: claiming ? colors.textMuted : colors.primary,
          color: '#fff',
          border: 'none',
          borderRadius: radius.md,
          fontSize: 14,
          fontWeight: 600,
          cursor: claiming ? 'wait' : 'pointer',
          transition: transitions.base,
        }}
      >
        {claiming ? 'Claiming...' : '✓ Accept as my patient'}
      </button>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontWeight: 500, color: colors.text, marginTop: 2 }}>{value}</div>
    </div>
  );
}