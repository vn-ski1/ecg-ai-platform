import { Link } from 'react-router-dom';
import { useTheme } from '../ThemeContext';
import { useTranslation } from 'react-i18next';

const heroImage = 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1600&q=80';
const aiImage = 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80';
const cloudImage = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80';
const hospitalImage = 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800&q=80';
const ecgWaveImage = 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1200&q=80';
const defenseImage1 = 'https://images.unsplash.com/photo-1496307653780-42ee777d4833?w=800&q=80';
const defenseImage2 = 'https://images.unsplash.com/photo-1550831107-1553da8c8464?w=800&q=80';
const defenseImage3 = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80';

export default function Home() {
  const { mode, toggleMode } = useTheme();
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(newLang);
    localStorage.setItem('ecg_language', newLang);
  };

  return (
    <div>
      {/* Floating toggles */}
      <div style={{
        position: 'fixed', top: 20, right: 20, zIndex: 1000,
        display: 'flex', gap: 8,
      }}>
        <button onClick={toggleLanguage} title="Change language" style={floatBtn(mode)}>
          {i18n.language === 'fr' ? 'FR' : 'EN'}
        </button>
        <button onClick={toggleMode} title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} style={floatBtn(mode)}>
          {mode === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* HERO SECTION */}
      <section style={hero.section}>
        <div style={hero.overlay}>
          <div style={hero.content}>
            <h1 style={hero.title}>{t('home.hero_title')}</h1>
            <p style={hero.subtitle}>{t('home.hero_subtitle')}</p>
            <p style={hero.tagline}>{t('home.hero_tagline')}</p>
            <div style={hero.ctaRow}>
              <Link to="/login" style={hero.ctaPrimary}>Sign In</Link>
              <Link to="/signup" style={hero.ctaSecondary}>Sign Up</Link>
              <a href="#features" style={{ ...hero.ctaSecondary, border: 'none' }}>{t('home.cta_learn_more')}</a>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section style={stats.section}>
        <div style={stats.grid}>
          <div style={stats.item}>
            <div style={stats.number}>96.4%</div>
            <div style={stats.label}>{t('home.stat_f1')}</div>
          </div>
          <div style={stats.item}>
            <div style={stats.number}>&lt; 5s</div>
            <div style={stats.label}>{t('home.stat_dispatch')}</div>
          </div>
          <div style={stats.item}>
            <div style={stats.number}>3-class</div>
            <div style={stats.label}>{t('home.stat_cnn')}</div>
          </div>
          <div style={stats.item}>
            <div style={stats.number}>+237</div>
            <div style={stats.label}>{t('home.stat_sms')}</div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={features.section}>
        <h2 style={features.heading}>{t('home.features_heading')}</h2>
        <p style={features.intro}>{t('home.features_intro')}</p>

        <div style={features.grid}>
          <FeatureCard
            image={hospitalImage}
            number="01"
            title={t('home.feature1_title')}
            text={t('home.feature1_text')}
          />
          <FeatureCard
            image={cloudImage}
            number="02"
            title={t('home.feature2_title')}
            text={t('home.feature2_text')}
          />
          <FeatureCard
            image={aiImage}
            number="03"
            title={t('home.feature3_title')}
            text={t('home.feature3_text')}
          />
          <FeatureCard
            image={ecgWaveImage}
            number="04"
            title={t('home.feature4_title')}
            text={t('home.feature4_text')}
          />
          <FeatureCard
            image={defenseImage1}
            number="05"
            title={t('home.defense1_title')}
            text={t('home.defense1_text')}
          />
          <FeatureCard
            image={defenseImage2}
            number="06"
            title={t('home.defense2_title')}
            text={t('home.defense2_text')}
          />
          <FeatureCard
            image={defenseImage3}
            number="07"
            title={t('home.defense3_title')}
            text={t('home.defense3_text')}
          />
        </div>
      </section>

      {/* ARCHITECTURE / ABOUT */}
      <section style={about.section}>
        <div style={about.grid}>
          <div style={about.text}>
            <h2 style={about.heading}>{t('home.about_heading')}</h2>
            <p style={about.paragraph}>{t('home.about_p1')}</p>
            <p style={about.paragraph}>{t('home.about_p2')}</p>
            <p style={about.paragraph}>{t('home.about_p3')}</p>
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
            <img className="about-image-hover" src={ecgWaveImage} alt="ECG waveform" style={about.image} />
          </div>
        </div>
      </section>

      {/* CTA STRIP */}
      <section style={cta.section}>
        <h2 style={cta.heading}>{t('home.cta_heading')}</h2>
        <p style={cta.subtitle}>{t('home.cta_subtitle')}</p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
          <Link to="/login" style={cta.button}>Sign In</Link>
          <Link to="/signup" style={{ ...cta.button, background: '#2e7d32', color: '#fff' }}>Sign Up</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={footer.section}>
        <p>{t('home.footer_credits')}</p>
        <p style={{ fontSize: 12, opacity: 0.75 }}>{t('home.footer_authors')}</p>
      </footer>
    </div>
  );
}

function FeatureCard({ image, number, title, text }) {
  return (
    <div className="feature-card" style={features.card}>
      <div className="feature-card-image" style={{ ...features.cardImage, backgroundImage: `url(${image})` }} />
      <div style={features.cardBody}>
        <div style={features.cardNumber}>{number}</div>
        <h3 style={features.cardTitle}>{title}</h3>
        <p style={features.cardText}>{text}</p>
      </div>
    </div>
  );
}

function floatBtn(mode) {
  return {
    background: mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.4)',
    color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
    width: 42, height: 42, borderRadius: '50%',
    cursor: 'pointer', fontSize: 14, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(10px)',
  };
}

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
  cardImage: { height: 180, backgroundSize: 'cover', backgroundPosition: 'center' },
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
  tag: { background: '#e8eaf6', color: '#1a237e', padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600 },
  imageWrap: { borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' },
  image: { width: '100%', display: 'block' },
};

const cta = {
  section: { background: 'linear-gradient(135deg, #1f4e79, #2e75b6)', color: '#fff', padding: '56px 32px', textAlign: 'center' },
  heading: { fontSize: 28, margin: 0 },
  subtitle: { fontSize: 16, marginTop: 12, opacity: 0.92 },
  button: { display: 'inline-block', background: '#fff', color: '#1f4e79', padding: '14px 32px', borderRadius: 6, marginTop: 24, textDecoration: 'none', fontWeight: 600, fontSize: 15 },
};

const footer = {
  section: { background: '#0f2745', color: '#fff', padding: '24px 32px', textAlign: 'center', fontSize: 13 },
};