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
from typing import List, Optional

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
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfgen import canvas as _rl_canvas


class NumberedCanvas(_rl_canvas.Canvas):
    """Two-pass canvas that writes 'Page X of Y' in the footer of every page."""
    def __init__(self, *args, **kwargs):
        _rl_canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_page_footer(num_pages)
            _rl_canvas.Canvas.showPage(self)
        _rl_canvas.Canvas.save(self)

    def _draw_page_footer(self, page_count):
        self.saveState()
        self.setFont('Helvetica', 8)
        self.setFillColor(rl_colors.HexColor('#94a3b8'))
        w, _ = A4
        self.drawString(2 * cm, 1.2 * cm,
                        "ECG AI Platform · Dossier patient confidentiel / Confidential Patient Record")
        self.drawRightString(w - 2 * cm, 1.2 * cm,
                             f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


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


# ─── Consolidated report — shared helpers & models ───────────────────────

def _draw_page_footer(canvas, doc):
    """Footer on every page: confidentiality notice left, page number right."""
    canvas.saveState()
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(rl_colors.HexColor('#94a3b8'))
    w, _ = A4
    canvas.drawString(2 * cm, 1.2 * cm,
                      "ECG AI Platform · Dossier patient confidentiel / Confidential Patient Record")
    canvas.drawRightString(w - 2 * cm, 1.2 * cm, f"Page {doc.page}")
    canvas.restoreState()


class PatientInfoPayload(BaseModel):
    patient_id: Optional[int] = None
    name: Optional[str] = None
    email: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    hospital_name: Optional[str] = None
    assigned_doctor_name: Optional[str] = None


class ECGRecordPayload(BaseModel):
    record_id: int
    recorded_at: Optional[str] = None
    rhythm_class: Optional[str] = None
    confidence: Optional[float] = None
    bpm: Optional[float] = None
    cvd_risk_score: Optional[int] = None
    cvd_risk_category: Optional[str] = None
    signal_data: Optional[List[float]] = None


class ConsolidatedReportRequest(BaseModel):
    patient: PatientInfoPayload
    records: List[ECGRecordPayload]


def _info_table(rows):
    """Reusable two-column info table (label | value) matching single-report style."""
    t = Table(rows, colWidths=[5 * cm, 11 * cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), rl_colors.HexColor('#f1f5f9')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, rl_colors.HexColor('#e2e8f0')),
    ]))
    return t


@app.post("/generate-consolidated-report")
def generate_consolidated_report(req: ConsolidatedReportRequest):
    """Generate a single consolidated PDF with all ECG records for a patient."""
    try:
        p = req.patient
        records = req.records

        pdf_buf = io.BytesIO()
        doc = SimpleDocTemplate(
            pdf_buf, pagesize=A4,
            rightMargin=2 * cm, leftMargin=2 * cm,
            topMargin=2 * cm, bottomMargin=2.5 * cm,
        )

        styles = getSampleStyleSheet()
        h1     = ParagraphStyle('CH1', parent=styles['Heading1'], fontSize=18,
                                textColor=rl_colors.HexColor('#0d4f5c'), spaceAfter=4)
        h2     = ParagraphStyle('CH2', parent=styles['Heading2'], fontSize=12,
                                textColor=rl_colors.HexColor('#0d4f5c'), spaceBefore=14, spaceAfter=6)
        meta   = ParagraphStyle('CMeta', parent=styles['Normal'], fontSize=9,
                                textColor=rl_colors.HexColor('#64748b'), spaceAfter=2)
        body   = ParagraphStyle('CBody', parent=styles['Normal'], fontSize=10, leading=14)
        big_title = ParagraphStyle('CBigTitle', parent=styles['Normal'], fontSize=15,
                                   fontName='Helvetica-Bold', textColor=rl_colors.HexColor('#0d4f5c'),
                                   alignment=TA_CENTER, spaceAfter=4, spaceBefore=12)
        sub_title = ParagraphStyle('CSubTitle', parent=styles['Normal'], fontSize=10,
                                   textColor=rl_colors.HexColor('#64748b'),
                                   alignment=TA_CENTER, spaceAfter=18)
        risk_high = ParagraphStyle('CRH', parent=styles['Normal'], fontSize=12,
                                   textColor=rl_colors.white,
                                   backColor=rl_colors.HexColor('#e63946'),
                                   alignment=TA_CENTER, spaceAfter=8, spaceBefore=4)
        risk_mod  = ParagraphStyle('CRM', parent=styles['Normal'], fontSize=12,
                                   textColor=rl_colors.white,
                                   backColor=rl_colors.HexColor('#f59e0b'),
                                   alignment=TA_CENTER, spaceAfter=8, spaceBefore=4)
        risk_low  = ParagraphStyle('CRL', parent=styles['Normal'], fontSize=12,
                                   textColor=rl_colors.white,
                                   backColor=rl_colors.HexColor('#10b981'),
                                   alignment=TA_CENTER, spaceAfter=8, spaceBefore=4)

        story = []

        # ── COVER PAGE ──────────────────────────────────────────────────────
        story.append(Paragraph("ECG AI Platform", h1))
        story.append(Paragraph("Cardiac Analysis Report — Hospital Integration Edition", meta))
        story.append(Paragraph(f"Issued: {datetime.now().strftime('%d %B %Y at %H:%M')}", meta))
        story.append(Spacer(1, 0.3 * cm))

        story.append(Paragraph("COMPLETE CARDIAC HISTORY REPORT", big_title))
        story.append(Paragraph("RAPPORT CARDIAQUE COMPLET / HISTORIQUE COMPLET DES ANALYSES ECG", sub_title))

        story.append(Paragraph("Patient Information", h2))
        story.append(_info_table([
            ['Patient Name',       p.name or '—'],
            ['Patient ID',         f"#{p.patient_id}" if p.patient_id else '—'],
            ['Date of Birth',      p.date_of_birth or '—'],
            ['Gender',             p.gender or '—'],
            ['Phone',              p.phone or '—'],
            ['Email',              p.email or '—'],
            ['Hospital',           p.hospital_name or '—'],
            ['Assigned Physician', p.assigned_doctor_name or '—'],
        ]))
        story.append(Spacer(1, 0.4 * cm))

        # Risk distribution summary
        n_high = sum(1 for r in records if r.cvd_risk_category == 'HIGH')
        n_mod  = sum(1 for r in records if r.cvd_risk_category == 'MODERATE')
        n_low  = sum(1 for r in records if r.cvd_risk_category == 'LOW')

        story.append(Paragraph("Report Summary", h2))
        story.append(_info_table([
            ['Total ECG Records',  str(len(records))],
            ['High Risk records',  str(n_high)],
            ['Moderate Risk records', str(n_mod)],
            ['Low Risk records',   str(n_low)],
            ['Generated on',       datetime.now().strftime('%d %B %Y at %H:%M')],
        ]))
        story.append(Spacer(1, 0.5 * cm))

        if len(records) == 0:
            story.append(Paragraph("<i>No ECG records are available for this patient yet.</i>", body))
            story.append(Spacer(1, 0.5 * cm))

        story.append(Paragraph("Medical Disclaimer", h2))
        story.append(Paragraph(
            "This report was generated by an AI-assisted decision support system. The classifications "
            "and CVD risk scores are not a medical diagnosis and should be interpreted in the context "
            "of the patient's full clinical history. Treatment decisions remain the responsibility of "
            "the qualified physician.", body))
        story.append(Spacer(1, 0.4 * cm))
        story.append(Paragraph(
            "<font size=8 color='#64748b'>ECG AI Platform · IUC B.Tech Final Project · "
            "School of Engineering and Applied Science, Douala</font>", body))

        if len(records) == 0:
            doc.build(story, onFirstPage=_draw_page_footer, onLaterPages=_draw_page_footer)
            pdf_buf.seek(0)
            return StreamingResponse(
                pdf_buf, media_type='application/pdf',
                headers={'Content-Disposition':
                         f'attachment; filename="ecg-full-history-{p.patient_id or "patient"}.pdf"'},
            )

        # ── SUMMARY TABLE (page 2) ───────────────────────────────────────
        story.append(PageBreak())
        story.append(Paragraph("ECG Records Summary", h2))
        story.append(Paragraph("All cardiac analyses — newest first.", meta))
        story.append(Spacer(1, 0.3 * cm))

        col_w = [1.5 * cm, 2.8 * cm, 3.2 * cm, 2 * cm, 3.2 * cm, 3.3 * cm]
        tbl_data = [['#', 'Date', 'Rhythm', 'BPM', 'CVD Risk', 'Confidence']]
        for r in records:
            date_str = '—'
            if r.recorded_at:
                try:
                    dt = datetime.fromisoformat(str(r.recorded_at).replace('Z', '+00:00'))
                    date_str = dt.strftime('%d/%m/%Y')
                except Exception:
                    date_str = str(r.recorded_at)[:10]
            tbl_data.append([
                f"#{r.record_id}",
                date_str,
                r.rhythm_class or '—',
                f"{int(r.bpm)}" if r.bpm else '—',
                r.cvd_risk_category or '—',
                f"{r.confidence * 100:.1f}%" if r.confidence is not None else '—',
            ])

        tbl_style = [
            ('BACKGROUND',  (0, 0), (-1, 0), rl_colors.HexColor('#0d4f5c')),
            ('TEXTCOLOR',   (0, 0), (-1, 0), rl_colors.white),
            ('FONTNAME',    (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE',    (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING',  (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('GRID',        (0, 0), (-1, -1), 0.5, rl_colors.HexColor('#e2e8f0')),
        ]
        # Alternating row backgrounds + color-coded risk column
        risk_colors = {'HIGH': ('#fee2e2', '#e63946'), 'MODERATE': ('#fef3c7', '#d97706'), 'LOW': ('#d1fae5', '#059669')}
        for i, r in enumerate(records, start=1):
            bg = rl_colors.white if i % 2 == 1 else rl_colors.HexColor('#f8fafc')
            tbl_style.append(('BACKGROUND', (0, i), (-1, i), bg))
            cat = r.cvd_risk_category or ''
            if cat in risk_colors:
                cell_bg, cell_fg = risk_colors[cat]
                tbl_style.append(('BACKGROUND', (4, i), (4, i), rl_colors.HexColor(cell_bg)))
                tbl_style.append(('TEXTCOLOR',  (4, i), (4, i), rl_colors.HexColor(cell_fg)))
                tbl_style.append(('FONTNAME',   (4, i), (4, i), 'Helvetica-Bold'))

        summary_tbl = Table(tbl_data, colWidths=col_w)
        summary_tbl.setStyle(TableStyle(tbl_style))
        story.append(summary_tbl)

        # ── DETAILED SECTION PER ECG ─────────────────────────────────────
        for r in records:
            story.append(PageBreak())

            date_str = '—'
            if r.recorded_at:
                try:
                    dt = datetime.fromisoformat(str(r.recorded_at).replace('Z', '+00:00'))
                    date_str = dt.strftime('%d %B %Y · %H:%M')
                except Exception:
                    date_str = str(r.recorded_at)

            story.append(Paragraph(f"ECG Record #{r.record_id}", h2))
            story.append(Paragraph(f"Recorded: {date_str}", meta))
            story.append(Spacer(1, 0.2 * cm))

            story.append(_info_table([
                ['Rhythm Classification', r.rhythm_class or '—'],
                ['Classifier Confidence', f"{r.confidence * 100:.1f}%" if r.confidence is not None else '—'],
                ['Heart Rate',            f"{int(r.bpm)} BPM" if r.bpm else '—'],
                ['CVD Risk Score',        f"{r.cvd_risk_score}/100" if r.cvd_risk_score is not None else '—'],
            ]))
            story.append(Spacer(1, 0.3 * cm))

            cat   = r.cvd_risk_category or 'NONE'
            score = r.cvd_risk_score or 0
            label = f"CVD Risk: {cat} — Score {score}/100"
            if cat == 'HIGH':
                story.append(Paragraph(label, risk_high))
            elif cat == 'MODERATE':
                story.append(Paragraph(label, risk_mod))
            else:
                story.append(Paragraph(label, risk_low))

            if r.signal_data:
                try:
                    wave_buf = render_ecg_waveform(r.signal_data, r.rhythm_class or 'Unknown', r.bpm or 0)
                    story.append(RLImage(wave_buf, width=16 * cm, height=5 * cm))
                except Exception as e:
                    story.append(Paragraph(f"<i>Waveform render failed: {e}</i>", body))
            else:
                story.append(Paragraph("<i>No signal data available for this record.</i>", body))

        doc.build(story, onFirstPage=_draw_page_footer, onLaterPages=_draw_page_footer)
        pdf_buf.seek(0)

        return StreamingResponse(
            pdf_buf, media_type='application/pdf',
            headers={'Content-Disposition':
                     f'attachment; filename="ecg-full-history-{p.patient_id or "patient"}.pdf"'},
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate consolidated PDF: {str(e)}")


# ─── Full report — new endpoint using NumberedCanvas ("Page X of Y") ─────

class FullReportPatient(BaseModel):
    patient_id: Optional[int] = None
    name: Optional[str] = None
    email: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    hospital_name: Optional[str] = None
    doctor_name: Optional[str] = None
    doctor_specialty: Optional[str] = None


class FullReportRecord(BaseModel):
    record_id: int
    recorded_at: Optional[str] = None
    rhythm_class: Optional[str] = None
    confidence: Optional[float] = None
    bpm: Optional[float] = None
    cvd_risk_score: Optional[int] = None
    cvd_risk_category: Optional[str] = None
    signal_data: Optional[List[float]] = None


class FullReportRequest(BaseModel):
    patient: FullReportPatient
    records: List[FullReportRecord]
    generated_at: Optional[str] = None


@app.post("/generate-full-report")
def generate_full_report(req: FullReportRequest):
    """Consolidated PDF with Page X of Y footers (NumberedCanvas) and full doctor info."""
    try:
        p = req.patient
        records = req.records

        # Human-readable generated-at string
        try:
            gen_dt = datetime.fromisoformat((req.generated_at or '').replace('Z', '+00:00'))
            gen_str = gen_dt.strftime('%d %B %Y at %H:%M')
        except Exception:
            gen_str = datetime.now().strftime('%d %B %Y at %H:%M')

        # Date range from records (oldest first)
        date_range = '—'
        if records:
            dates = []
            for r in records:
                if r.recorded_at:
                    try:
                        dates.append(datetime.fromisoformat(str(r.recorded_at).replace('Z', '+00:00')))
                    except Exception:
                        pass
            if dates:
                date_range = f"{min(dates).strftime('%d/%m/%Y')} → {max(dates).strftime('%d/%m/%Y')}"

        pdf_buf = io.BytesIO()
        doc = SimpleDocTemplate(
            pdf_buf, pagesize=A4,
            rightMargin=2 * cm, leftMargin=2 * cm,
            topMargin=2 * cm, bottomMargin=2.5 * cm,
        )

        styles = getSampleStyleSheet()
        h1        = ParagraphStyle('FH1', parent=styles['Heading1'], fontSize=18,
                                   textColor=rl_colors.HexColor('#0d4f5c'), spaceAfter=4)
        h2        = ParagraphStyle('FH2', parent=styles['Heading2'], fontSize=12,
                                   textColor=rl_colors.HexColor('#0d4f5c'), spaceBefore=14, spaceAfter=6)
        meta      = ParagraphStyle('FMeta', parent=styles['Normal'], fontSize=9,
                                   textColor=rl_colors.HexColor('#64748b'), spaceAfter=2)
        body      = ParagraphStyle('FBody', parent=styles['Normal'], fontSize=10, leading=14)
        big_title = ParagraphStyle('FBig', parent=styles['Normal'], fontSize=15,
                                   fontName='Helvetica-Bold', textColor=rl_colors.HexColor('#0d4f5c'),
                                   alignment=TA_CENTER, spaceAfter=4, spaceBefore=12)
        sub_title = ParagraphStyle('FSub', parent=styles['Normal'], fontSize=10,
                                   textColor=rl_colors.HexColor('#64748b'),
                                   alignment=TA_CENTER, spaceAfter=18)
        risk_high = ParagraphStyle('FRH', parent=styles['Normal'], fontSize=12,
                                   textColor=rl_colors.white,
                                   backColor=rl_colors.HexColor('#e63946'),
                                   alignment=TA_CENTER, spaceAfter=8, spaceBefore=4)
        risk_mod  = ParagraphStyle('FRM', parent=styles['Normal'], fontSize=12,
                                   textColor=rl_colors.white,
                                   backColor=rl_colors.HexColor('#f59e0b'),
                                   alignment=TA_CENTER, spaceAfter=8, spaceBefore=4)
        risk_low  = ParagraphStyle('FRL', parent=styles['Normal'], fontSize=12,
                                   textColor=rl_colors.white,
                                   backColor=rl_colors.HexColor('#10b981'),
                                   alignment=TA_CENTER, spaceAfter=8, spaceBefore=4)

        story = []

        # ── COVER PAGE ───────────────────────────────────────────────────────
        story.append(Paragraph("ECG AI Platform", h1))
        story.append(Paragraph("Cardiac Analysis Report — Hospital Integration Edition", meta))
        story.append(Paragraph(f"Generated: {gen_str}", meta))
        story.append(Spacer(1, 0.3 * cm))

        story.append(Paragraph("COMPLETE CARDIAC HISTORY REPORT", big_title))
        story.append(Paragraph(
            "RAPPORT CARDIAQUE COMPLET / HISTORIQUE COMPLET DES ANALYSES ECG", sub_title))

        physician_label = p.doctor_name or '—'
        if p.doctor_specialty:
            physician_label += f" · {p.doctor_specialty}"

        story.append(Paragraph("Patient Information", h2))
        story.append(_info_table([
            ['Patient Name',       p.name or '—'],
            ['Patient ID',         f"#{p.patient_id}" if p.patient_id else '—'],
            ['Date of Birth',      p.date_of_birth or '—'],
            ['Gender',             p.gender or '—'],
            ['Phone',              p.phone or '—'],
            ['Email',              p.email or '—'],
            ['Hospital',           p.hospital_name or '—'],
            ['Assigned Physician', physician_label],
        ]))
        story.append(Spacer(1, 0.4 * cm))

        n_high = sum(1 for r in records if r.cvd_risk_category == 'HIGH')
        n_mod  = sum(1 for r in records if r.cvd_risk_category == 'MODERATE')
        n_low  = sum(1 for r in records if r.cvd_risk_category == 'LOW')

        story.append(Paragraph("Report Summary", h2))
        story.append(_info_table([
            ['Total ECG Records',     str(len(records))],
            ['Date Range',            date_range],
            ['High Risk records',     str(n_high)],
            ['Moderate Risk records', str(n_mod)],
            ['Low Risk records',      str(n_low)],
        ]))
        story.append(Spacer(1, 0.5 * cm))

        story.append(Paragraph("Medical Disclaimer", h2))
        story.append(Paragraph(
            "This report was generated by an AI-assisted decision support system. The classifications "
            "and CVD risk scores are not a medical diagnosis and should be interpreted in the context "
            "of the patient's full clinical history. Treatment decisions remain the responsibility of "
            "the qualified physician.", body))
        story.append(Spacer(1, 0.4 * cm))
        story.append(Paragraph(
            "<font size=8 color='#64748b'>ECG AI Platform · IUC B.Tech Final Project · "
            "School of Engineering and Applied Science, Douala</font>", body))

        # ── SUMMARY TABLE (page 2) ────────────────────────────────────────
        story.append(PageBreak())
        story.append(Paragraph("ECG Records Summary", h2))
        story.append(Paragraph("All cardiac analyses — oldest first.", meta))
        story.append(Spacer(1, 0.3 * cm))

        col_w = [1.5 * cm, 2.8 * cm, 3.2 * cm, 2 * cm, 3.2 * cm, 3.3 * cm]
        tbl_data = [['#', 'Date', 'Rhythm', 'BPM', 'CVD Risk', 'Confidence']]
        for r in records:
            date_str = '—'
            if r.recorded_at:
                try:
                    dt = datetime.fromisoformat(str(r.recorded_at).replace('Z', '+00:00'))
                    date_str = dt.strftime('%d/%m/%Y')
                except Exception:
                    date_str = str(r.recorded_at)[:10]
            tbl_data.append([
                f"#{r.record_id}",
                date_str,
                r.rhythm_class or '—',
                f"{int(r.bpm)}" if r.bpm else '—',
                r.cvd_risk_category or '—',
                f"{r.confidence * 100:.1f}%" if r.confidence is not None else '—',
            ])

        tbl_style = [
            ('BACKGROUND',    (0, 0), (-1, 0), rl_colors.HexColor('#0d4f5c')),
            ('TEXTCOLOR',     (0, 0), (-1, 0), rl_colors.white),
            ('FONTNAME',      (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE',      (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING',    (0, 0), (-1, -1), 6),
            ('LEFTPADDING',   (0, 0), (-1, -1), 8),
            ('GRID',          (0, 0), (-1, -1), 0.5, rl_colors.HexColor('#e2e8f0')),
        ]
        risk_colors = {
            'HIGH':     ('#fee2e2', '#e63946'),
            'MODERATE': ('#fef3c7', '#d97706'),
            'LOW':      ('#d1fae5', '#059669'),
        }
        for i, r in enumerate(records, start=1):
            bg = rl_colors.white if i % 2 == 1 else rl_colors.HexColor('#f8fafc')
            tbl_style.append(('BACKGROUND', (0, i), (-1, i), bg))
            cat = r.cvd_risk_category or ''
            if cat in risk_colors:
                cell_bg, cell_fg = risk_colors[cat]
                tbl_style.append(('BACKGROUND', (4, i), (4, i), rl_colors.HexColor(cell_bg)))
                tbl_style.append(('TEXTCOLOR',  (4, i), (4, i), rl_colors.HexColor(cell_fg)))
                tbl_style.append(('FONTNAME',   (4, i), (4, i), 'Helvetica-Bold'))

        story.append(Table(tbl_data, colWidths=col_w, style=TableStyle(tbl_style)))

        # ── DETAILED SECTION PER RECORD ───────────────────────────────────
        for r in records:
            story.append(PageBreak())

            date_str = '—'
            if r.recorded_at:
                try:
                    dt = datetime.fromisoformat(str(r.recorded_at).replace('Z', '+00:00'))
                    date_str = dt.strftime('%d %B %Y · %H:%M')
                except Exception:
                    date_str = str(r.recorded_at)

            story.append(Paragraph(f"ECG Record #{r.record_id}", h2))
            story.append(Paragraph(f"Recorded: {date_str}", meta))
            story.append(Spacer(1, 0.2 * cm))

            story.append(_info_table([
                ['Rhythm Classification', r.rhythm_class or '—'],
                ['Classifier Confidence', f"{r.confidence * 100:.1f}%" if r.confidence is not None else '—'],
                ['Heart Rate',            f"{int(r.bpm)} BPM" if r.bpm else '—'],
                ['CVD Risk Score',        f"{r.cvd_risk_score}/100" if r.cvd_risk_score is not None else '—'],
            ]))
            story.append(Spacer(1, 0.3 * cm))

            cat   = r.cvd_risk_category or 'NONE'
            score = r.cvd_risk_score or 0
            label = f"CVD Risk: {cat} — Score {score}/100"
            if cat == 'HIGH':
                story.append(Paragraph(label, risk_high))
            elif cat == 'MODERATE':
                story.append(Paragraph(label, risk_mod))
            else:
                story.append(Paragraph(label, risk_low))

            if r.signal_data:
                try:
                    wave_buf = render_ecg_waveform(
                        r.signal_data, r.rhythm_class or 'Unknown', r.bpm or 0)
                    story.append(RLImage(wave_buf, width=16 * cm, height=5 * cm))
                except Exception as e:
                    story.append(Paragraph(f"<i>Waveform render failed: {e}</i>", body))
            else:
                story.append(Paragraph("<i>No signal data available for this record.</i>", body))

        doc.build(story, canvasmaker=NumberedCanvas)
        pdf_buf.seek(0)

        today = datetime.now().strftime('%Y-%m-%d')
        safe_id = p.patient_id or 'patient'
        return StreamingResponse(
            pdf_buf, media_type='application/pdf',
            headers={'Content-Disposition':
                     f'attachment; filename="ecg-full-history-{safe_id}-{today}.pdf"'},
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate full PDF: {str(e)}")