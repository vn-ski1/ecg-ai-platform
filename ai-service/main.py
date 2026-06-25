"""
ECG AI Service — FastAPI application
Loads the trained 1D-CNN model and exposes /predict and /report endpoints
"""
from dotenv import load_dotenv
load_dotenv()
import os
# CRITICAL: must be set before psycopg2 imports to fix the encoding handshake
# on Windows systems with non-UTF-8 default locale (e.g. French Windows)
os.environ.setdefault('PGCLIENTENCODING', 'UTF8')

import io
import pickle
from pathlib import Path
from datetime import datetime
from typing import List

import numpy as np
import psycopg2
from psycopg2.extras import RealDictCursor

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from tensorflow.keras.models import load_model

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors as rl_colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from reportlab.lib.enums import TA_CENTER, TA_LEFT


# ─── App setup ────────────────────────────────────────────────────────────
app = FastAPI(
    title="ECG AI Service",
    description="1D-CNN arrhythmia classifier + CVD risk prediction + PDF reports",
    version="1.0.0"
)


# ─── Database connection config ──────────────────────────────────────────
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': os.environ.get('DB_PORT', '5432'),
    'database': os.environ.get('DB_NAME', 'ecg_platform'),
    'user': os.environ.get('DB_USER', 'postgres'),
    'password': os.environ.get('DB_PASSWORD', 'postgres'),
    'client_encoding': 'UTF8',
}


def get_db_connection():
    """Open a fresh DB connection for the request."""
    return psycopg2.connect(**DB_CONFIG)


# ─── Load model once at startup (not on every request — too slow) ─────────
MODEL_DIR = Path(__file__).parent.parent / "model-files"
MODEL_PATH = MODEL_DIR / "ecg_1dcnn_model.keras"
ENCODER_PATH = MODEL_DIR / "label_encoder_3class.pkl"

print(f"Loading model from: {MODEL_PATH}")
model = load_model(MODEL_PATH)
print("Model loaded successfully.")

with open(ENCODER_PATH, "rb") as f:
    label_encoder = pickle.load(f)
print(f"Class order: {list(label_encoder.classes_)}")


# ─── Request and response data structures ────────────────────────────────
class ECGPredictRequest(BaseModel):
    """An incoming prediction request from the gateway."""
    signal: List[float]
    rr_interval: float = None


class ECGPredictResponse(BaseModel):
    """The result returned to the gateway."""
    rhythm_class: str
    confidence: float
    cnn_class: str
    bpm: float = None
    cvd_risk_score: int
    cvd_risk_category: str


# ─── 5-class label logic (CNN + BPM rule combined) ───────────────────────
def apply_full_classification(cnn_class: str, rr_interval: float = None) -> tuple:
    """Combine CNN prediction with rate-based rule to return final 5-class label + BPM."""
    bpm = None
    if rr_interval is not None and rr_interval > 0:
        bpm = 60.0 / rr_interval

    if cnn_class in ['AFib', 'PVC']:
        return cnn_class, bpm

    if bpm is not None:
        if bpm > 100:
            return 'Tachycardia', bpm
        if bpm < 60:
            return 'Bradycardia', bpm

    return 'Normal', bpm


# ─── Simple CVD risk score ───────────────────────────────────────────────
def compute_cvd_risk(final_class: str, confidence: float) -> tuple:
    base_scores = {
        'Normal': 10,
        'Bradycardia': 40,
        'Tachycardia': 50,
        'PVC': 70,
        'AFib': 80,
    }
    score = base_scores.get(final_class, 30)
    if final_class != 'Normal':
        score = min(100, int(score + confidence * 10))

    if score >= 67:
        category = 'HIGH'
    elif score >= 34:
        category = 'MODERATE'
    else:
        category = 'LOW'

    return score, category


# ─── Endpoints ───────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "service": "ECG AI Service",
        "status": "online",
        "model_classes": list(label_encoder.classes_)
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/predict", response_model=ECGPredictResponse)
def predict(request: ECGPredictRequest):
    if len(request.signal) != 360:
        raise HTTPException(
            status_code=400,
            detail=f"signal must contain exactly 360 samples, got {len(request.signal)}"
        )

    x = np.array(request.signal).reshape(1, 360, 1).astype("float32")
    probs = model.predict(x, verbose=0)[0]
    cnn_idx = int(np.argmax(probs))
    cnn_class = label_encoder.classes_[cnn_idx]
    confidence = float(probs[cnn_idx])

    final_class, bpm = apply_full_classification(cnn_class, request.rr_interval)
    cvd_score, cvd_category = compute_cvd_risk(final_class, confidence)

    return ECGPredictResponse(
        rhythm_class=final_class,
        confidence=round(confidence, 4),
        cnn_class=cnn_class,
        bpm=round(bpm, 1) if bpm is not None else None,
        cvd_risk_score=cvd_score,
        cvd_risk_category=cvd_category
    )


def render_ecg_waveform(signal_data, rhythm_class, bpm):
    """Render the ECG signal as a PNG buffer for embedding in the PDF."""
    fig, ax = plt.subplots(figsize=(7.5, 2.4), dpi=120)
    ax.plot(signal_data, color='#0d4f5c', linewidth=1.0)
    ax.set_xlabel('Sample (sampling rate 360 Hz)', fontsize=8)
    ax.set_ylabel('Voltage (mV)', fontsize=8)
    ax.set_title(f'ECG Waveform — Rhythm: {rhythm_class} · {int(bpm)} BPM', fontsize=10, fontweight='bold')
    ax.grid(True, alpha=0.3, linestyle=':')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=120)
    plt.close(fig)
    buf.seek(0)
    return buf


@app.get("/report/{record_id}")
def generate_ecg_report(record_id: int):
    """Generate a printable PDF medical report for a single ECG record."""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT
                er.record_id, er.recorded_at, er.created_at, er.signal_data,
                er.rhythm_class, er.confidence, er.cnn_class, er.bpm,
                er.cvd_risk_score, er.cvd_risk_category, er.rr_interval,
                p.patient_id, p.name AS patient_name, p.date_of_birth, p.phone, p.email, p.gender,
                h.hospital_name,
                d.name AS doctor_name, d.specialty AS doctor_specialty
            FROM ecg_records er
            LEFT JOIN patients p ON p.patient_id = er.patient_id
            LEFT JOIN hospitals h ON h.hospital_id = er.hospital_id
            LEFT JOIN doctors d ON d.doctor_id = p.assigned_doctor_id
            WHERE er.record_id = %s
        """, (record_id,))
        row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail=f"ECG record {record_id} not found")

        pdf_buf = io.BytesIO()
        doc = SimpleDocTemplate(
            pdf_buf, pagesize=A4,
            rightMargin=2*cm, leftMargin=2*cm,
            topMargin=2*cm, bottomMargin=2*cm,
        )
        styles = getSampleStyleSheet()
        story = []

        h1 = ParagraphStyle('H1', parent=styles['Heading1'], fontSize=18, textColor=rl_colors.HexColor('#0d4f5c'), spaceAfter=4, alignment=TA_LEFT)
        h2 = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=12, textColor=rl_colors.HexColor('#0d4f5c'), spaceBefore=14, spaceAfter=6)
        meta = ParagraphStyle('Meta', parent=styles['Normal'], fontSize=9, textColor=rl_colors.HexColor('#64748b'), spaceAfter=2)
        body = ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, leading=14)
        risk_high = ParagraphStyle('RiskHigh', parent=styles['Normal'], fontSize=14, textColor=rl_colors.HexColor('#ffffff'), backColor=rl_colors.HexColor('#e63946'), alignment=TA_CENTER, spaceAfter=10)
        risk_mod = ParagraphStyle('RiskMod', parent=styles['Normal'], fontSize=14, textColor=rl_colors.HexColor('#ffffff'), backColor=rl_colors.HexColor('#f59e0b'), alignment=TA_CENTER, spaceAfter=10)
        risk_low = ParagraphStyle('RiskLow', parent=styles['Normal'], fontSize=14, textColor=rl_colors.HexColor('#ffffff'), backColor=rl_colors.HexColor('#10b981'), alignment=TA_CENTER, spaceAfter=10)

        story.append(Paragraph("ECG AI Platform", h1))
        story.append(Paragraph("Cardiac Analysis Report — Hospital Integration Edition", meta))
        story.append(Paragraph(f"Issued: {datetime.now().strftime('%d %B %Y at %H:%M')}", meta))
        story.append(Spacer(1, 0.5*cm))

        story.append(Paragraph("Patient Information", h2))
        dob_str = row['date_of_birth'].strftime('%d %B %Y') if row['date_of_birth'] else '—'
        patient_info = [
            ['Patient Name', row['patient_name'] or '—'],
            ['Patient ID', f"#{row['patient_id']}"],
            ['Date of Birth', dob_str],
            ['Gender', row['gender'] or '—'],
            ['Phone', row['phone'] or '—'],
            ['Email', row['email'] or '—'],
            ['Hospital', row['hospital_name'] or '—'],
            ['Assigned Physician', f"{row['doctor_name'] or '—'} · {row['doctor_specialty'] or ''}"],
        ]
        patient_table = Table(patient_info, colWidths=[5*cm, 11*cm])
        patient_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), rl_colors.HexColor('#f1f5f9')),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, rl_colors.HexColor('#e2e8f0')),
        ]))
        story.append(patient_table)

        story.append(Paragraph("Recording Details", h2))
        rec_at = row['recorded_at'].strftime('%d %B %Y · %H:%M:%S') if row['recorded_at'] else '—'
        recording_info = [
            ['Record ID', f"#{row['record_id']}"],
            ['Recorded At', rec_at],
            ['Sampling Rate', '360 Hz'],
            ['Window Size', '360 samples (~1 second)'],
            ['RR Interval', f"{row['rr_interval']:.2f} s" if row['rr_interval'] else '—'],
        ]
        rec_table = Table(recording_info, colWidths=[5*cm, 11*cm])
        rec_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), rl_colors.HexColor('#f1f5f9')),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, rl_colors.HexColor('#e2e8f0')),
        ]))
        story.append(rec_table)

        story.append(Paragraph("AI Analysis Results", h2))
        confidence_pct = (row['confidence'] or 0) * 100
        ai_info = [
            ['Rhythm Classification', row['rhythm_class'] or '—'],
            ['CNN Predicted Class', row['cnn_class'] or '—'],
            ['Classifier Confidence', f"{confidence_pct:.1f}%"],
            ['Heart Rate', f"{int(row['bpm'])} BPM" if row['bpm'] else '—'],
        ]
        ai_table = Table(ai_info, colWidths=[5*cm, 11*cm])
        ai_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), rl_colors.HexColor('#f1f5f9')),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, rl_colors.HexColor('#e2e8f0')),
        ]))
        story.append(ai_table)
        story.append(Spacer(1, 0.5*cm))

        cat = row['cvd_risk_category'] or 'NONE'
        score = row['cvd_risk_score'] or 0
        risk_label = f"CVD Risk: {cat} — Score {score}/100"
        if cat == 'HIGH':
            story.append(Paragraph(risk_label, risk_high))
        elif cat == 'MODERATE':
            story.append(Paragraph(risk_label, risk_mod))
        else:
            story.append(Paragraph(risk_label, risk_low))

        story.append(Paragraph("ECG Waveform", h2))
        try:
            signal = row['signal_data']
            if isinstance(signal, str):
                import json
                signal = json.loads(signal)
            if signal is None:
                raise ValueError('signal_data is empty')
            wave_buf = render_ecg_waveform(signal, row['rhythm_class'] or 'Unknown', row['bpm'] or 0)
            story.append(RLImage(wave_buf, width=16*cm, height=5*cm))
        except Exception as e:
            story.append(Paragraph(f"<i>Waveform render failed: {e}</i>", body))

        story.append(Spacer(1, 0.5*cm))
        story.append(Paragraph("Important Notice", h2))
        notice = (
            "This report was generated by an AI-assisted decision support system. The classifications "
            "and CVD risk score are not a medical diagnosis and should be interpreted in the context "
            "of the patient's full clinical history. Treatment decisions remain the responsibility of "
            "the qualified physician."
        )
        story.append(Paragraph(notice, body))

        story.append(Spacer(1, 1*cm))
        footer = (
            "<font size=8 color='#64748b'>ECG AI Platform · IUC B.Tech Final Project · "
            "School of Engineering and Applied Science, Douala</font>"
        )
        story.append(Paragraph(footer, body))

        doc.build(story)
        pdf_buf.seek(0)

        safe_name = (row['patient_name'] or 'patient').replace(' ', '_').replace('/', '_')
        filename = f"ECG_Report_{record_id}_{safe_name}.pdf"
        return StreamingResponse(
            pdf_buf,
            media_type='application/pdf',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'},
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
    finally:
        if conn:
            conn.close()