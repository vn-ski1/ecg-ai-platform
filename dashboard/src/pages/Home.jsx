import { Link } from 'react-router-dom';
import { useTheme } from '../ThemeContext';

const heroImage = 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1600&q=80';
const aiImage = 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80';
const cloudImage = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80';
const hospitalImage = 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800&q=80';
const ecgWaveImage = 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1200&q=80';

export default function Home() {
  const { mode, toggleMode } = useTheme();

  return (
    <div>
      {/* Floating theme toggle */}
      <button onClick={toggleMode} title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} style={{
        position: 'fixed', top: 20, right: 20, zIndex: 1000,
        background: mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.4)',
        color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
        width: 42, height: 42, borderRadius: '50%',
        cursor: 'pointer', fontSize: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(10px)',
      }}>
        {mode === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* HERO SECTION */}
      <section style={hero.section}>
        <div style={hero.overlay}>
          <div style={hero.content}>
            <h1 style={hero.title}>Cloud-Native ECG AI Platform</h1>
            <p style={hero.subtitle}>
              Hospital Integration · 1D-CNN Arrhythmia Detection · CVD Risk Prediction
            </p>
            <p style={hero.tagline}>
              Bridging hospital ECG equipment with real-time AI cardiac analysis and proactive physician alerts.
            </p>
            <div style={hero.ctaRow}>
              <Link to="/login" style={hero.ctaPrimary}>Doctor Login →</Link>
              <Link to="/patient/signup" style={hero.ctaSecondary}>Patient Sign Up →</Link>
              <a href="#features" style={{ ...hero.ctaSecondary, border: 'none' }}>Learn More</a>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section style={stats.section}>
        <div style={stats.grid}>
          <div style={stats.item}>
            <div style={stats.number}>96.4%</div>
            <div style={stats.label}>Weighted F1-score on MIT-BIH</div>
          </div>
          <div style={stats.item}>
            <div style={stats.number}>&lt; 5s</div>
            <div style={stats.label}>End-to-end alert dispatch</div>
          </div>
          <div style={stats.item}>
            <div style={stats.number}>3-class</div>
            <div style={stats.label}>1D-CNN: AFib · Normal · PVC</div>
          </div>
          <div style={stats.item}>
            <div style={stats.number}>+237</div>
            <div style={stats.label}>SMS-based alerts via Twilio</div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={features.section}>
        <h2 style={features.heading}>How It Works</h2>
        <p style={features.intro}>
          A complete five-layer cloud-native architecture that connects existing hospital ECG equipment
          to an AI processing engine, with real-time results delivered to physicians.
        </p>

        <div style={features.grid}>
          <FeatureCard
            image={hospitalImage}
            number="01"
            title="Hospital ECG Acquisition"
            text="Standard 12-lead ECG equipment already deployed in Cameroonian hospitals captures the patient's cardiac signal during a routine examination."
          />
          <FeatureCard
            image={cloudImage}
            number="02"
            title="Cloud Integration Gateway"
            text="ECG data is securely transmitted via HTTPS API with hospital-level authentication. No wearable device required — the workflow plugs into existing hospital practice."
          />
          <FeatureCard
            image={aiImage}
            number="03"
            title="AI Cardiac Analysis"
            text="A 1D Convolutional Neural Network classifies the heartbeat rhythm and an XGBoost model predicts cardiovascular disease risk on a 0–100 scale."
          />
          <FeatureCard
            image={ecgWaveImage}
            number="04"
            title="Real-Time Alerts"
            text="When HIGH cardiovascular risk is detected, the responsible physician receives an SMS alert within 5 seconds — even if they are away from the dashboard."
          />
        </div>
      </section>

      {/* ARCHITECTURE / ABOUT */}
      <section style={about.section}>
        <div style={about.grid}>
          <div style={about.text}>
            <h2 style={about.heading}>Built for Healthcare in Africa</h2>
            <p style={about.paragraph}>
              This platform was designed as the final-year B.Tech project of the
              School of Engineering and Applied Science at the University Institute
              of the Coast (IUC), Douala.
            </p>
            <p style={about.paragraph}>
              It addresses the specific challenges of cardiac diagnosis in
              resource-constrained settings: shortage of cardiologists,
              limited cardiac AI tools tailored for African contexts, and delayed
              identification of high-risk patients.
            </p>
            <p style={about.paragraph}>
              The system uses peer-reviewed, clinically validated data sources
              (the MIT-BIH Arrhythmia Database) and follows international
              standards for medical software, including HL7 FHIR for data exchange.
            </p>
            <div style={about.tags}>
              <span style={about.tag}>FastAPI</span>
              <span style={about.tag}>Node.js</span>
              <span style={about.tag}>React</span>
              <span style={about.tag}>PostgreSQL</span>
              <span style={about.tag}>TensorFlow</span>
              <span style={about.tag}>Twilio</span>
              <span style={about.tag}>AWS-ready</span>
            </div>
          </div>
          <div style={about.imageWrap}>
            <img src={ecgWaveImage} alt="ECG waveform" style={about.image} />
          </div>
        </div>
      </section>

      {/* CTA STRIP */}
      <section style={cta.section}>
        <h2 style={cta.heading}>Ready to access the platform?</h2>
        <p style={cta.subtitle}>Doctors review patient data · Patients track their own cardiac health.</p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          <Link to="/login" style={cta.button}>Doctor Login →</Link>
          <Link to="/patient/signup" style={{ ...cta.button, background: '#2e7d32', color: '#fff' }}>Patient Sign Up →</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={footer.section}>
        <p>© 2026 ECG AI Platform · IUC B.Tech Final Project · School of Engineering and Applied Science</p>
        <p style={{ fontSize: 12, opacity: 0.75 }}>EKWED LAURENCE JUNIOR & EKWE DANIEL FLORIAN · Supervisor: Mr. DONGMO KENFACK VANICK</p>
      </footer>
    </div>
  );
}

function FeatureCard({ image, number, title, text }) {
  return (
    <div style={features.card}>
      <div style={{ ...features.cardImage, backgroundImage: `url(${image})` }} />
      <div style={features.cardBody}>
        <div style={features.cardNumber}>{number}</div>
        <h3 style={features.cardTitle}>{title}</h3>
        <p style={features.cardText}>{text}</p>
      </div>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────
const hero = {
  section: {
    minHeight: '70vh',
    backgroundImage: `linear-gradient(135deg, rgba(31, 78, 121, 0.92), rgba(15, 39, 69, 0.85)), url(${heroImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
  },
  overlay: { width: '100%', padding: '60px 32px' },
  content: { maxWidth: 900, margin: '0 auto', textAlign: 'center' },
  title: { fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 700, margin: 0, lineHeight: 1.15 },
  subtitle: { fontSize: 'clamp(13px, 1.5vw, 16px)', margin: '12px 0 0 0', opacity: 0.92, letterSpacing: 1 },
  tagline: { fontSize: 'clamp(15px, 2vw, 19px)', margin: '24px auto 0', maxWidth: 720, opacity: 0.95, lineHeight: 1.5 },
  ctaRow: { marginTop: 36, display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' },
  ctaPrimary: {
    background: '#fff', color: '#1f4e79', textDecoration: 'none',
    padding: '14px 32px', borderRadius: 6, fontWeight: 600, fontSize: 15,
  },
  ctaSecondary: {
    background: 'transparent', color: '#fff', textDecoration: 'none',
    padding: '14px 32px', borderRadius: 6, fontWeight: 600, fontSize: 15,
    border: '1.5px solid rgba(255,255,255,0.7)',
  },
};

const stats = {
  section: { background: '#1f4e79', color: '#fff', padding: '32px 16px' },
  grid: {
    maxWidth: 1100, margin: '0 auto',
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24,
    textAlign: 'center',
  },
  item: { padding: '8px' },
  number: { fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, color: '#fff' },
  label: { fontSize: 13, opacity: 0.85, marginTop: 4 },
};

const features = {
  section: { padding: '64px 32px', maxWidth: 1200, margin: '0 auto' },
  heading: { textAlign: 'center', fontSize: 32, color: '#1f4e79', margin: 0 },
  intro: { textAlign: 'center', color: '#555', maxWidth: 700, margin: '12px auto 48px', fontSize: 16, lineHeight: 1.6 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 },
  card: {
    background: '#fff', borderRadius: 8, overflow: 'hidden',
    boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  cardImage: {
    height: 180, backgroundSize: 'cover', backgroundPosition: 'center',
  },
  cardBody: { padding: 24 },
  cardNumber: { color: '#2e75b6', fontWeight: 700, fontSize: 14, letterSpacing: 1, marginBottom: 8 },
  cardTitle: { color: '#1f4e79', fontSize: 18, margin: '0 0 12px 0' },
  cardText: { color: '#555', fontSize: 14, lineHeight: 1.6, margin: 0 },
};

const about = {
  section: { padding: '64px 32px', background: '#f5f7fa' },
  grid: {
    maxWidth: 1200, margin: '0 auto',
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 48, alignItems: 'center',
  },
  text: {},
  heading: { color: '#1f4e79', fontSize: 30, margin: 0 },
  paragraph: { color: '#444', fontSize: 15, lineHeight: 1.7, marginTop: 16 },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 24 },
  tag: {
    background: '#e8eaf6', color: '#1a237e',
    padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
  },
  imageWrap: { borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' },
  image: { width: '100%', display: 'block' },
};

const cta = {
  section: {
    background: 'linear-gradient(135deg, #1f4e79, #2e75b6)',
    color: '#fff', padding: '56px 32px', textAlign: 'center',
  },
  heading: { fontSize: 28, margin: 0 },
  subtitle: { fontSize: 16, marginTop: 12, opacity: 0.92 },
  button: {
    display: 'inline-block', background: '#fff', color: '#1f4e79',
    padding: '14px 32px', borderRadius: 6, marginTop: 24,
    textDecoration: 'none', fontWeight: 600, fontSize: 15,
  },
};

const footer = {
  section: {
    background: '#0f2745', color: '#fff', padding: '24px 32px',
    textAlign: 'center', fontSize: 13,
  },
};