"""
ECG AI Service — FastAPI application
Loads the trained 1D-CNN model and exposes a /predict endpoint
"""

import numpy as np
import pickle
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from tensorflow.keras.models import load_model

# ─── App setup ────────────────────────────────────────────────────────────
app = FastAPI(
    title="ECG AI Service",
    description="1D-CNN arrhythmia classifier + CVD risk prediction",
    version="1.0.0"
)

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
    signal: List[float]      # 360 float samples — the heartbeat window
    rr_interval: float = None  # optional: seconds to previous R-peak

class ECGPredictResponse(BaseModel):
    """The result returned to the gateway."""
    rhythm_class: str        # 'Normal', 'AFib', 'PVC', 'Tachycardia', or 'Bradycardia'
    confidence: float        # 0.0 to 1.0
    cnn_class: str           # what the CNN said before BPM rule applied
    bpm: float = None
    cvd_risk_score: int      # 0–100
    cvd_risk_category: str   # 'LOW', 'MODERATE', 'HIGH'


# ─── 5-class label logic (CNN + BPM rule combined) ───────────────────────
def apply_full_classification(cnn_class: str, rr_interval: float = None) -> tuple:
    """Combine CNN prediction with rate-based rule to return final 5-class label + BPM."""
    bpm = None
    if rr_interval is not None and rr_interval > 0:
        bpm = 60.0 / rr_interval

    # AFib and PVC override rate-based labels
    if cnn_class in ['AFib', 'PVC']:
        return cnn_class, bpm

    # CNN said Normal — check rate
    if bpm is not None:
        if bpm > 100:
            return 'Tachycardia', bpm
        if bpm < 60:
            return 'Bradycardia', bpm

    return 'Normal', bpm


# ─── Simple CVD risk score ───────────────────────────────────────────────
def compute_cvd_risk(final_class: str, confidence: float) -> tuple:
    """
    Simple rule-based CVD risk score for now. Will be replaced by the
    XGBoost predictor in a later iteration once we add ECG feature extraction.
    """
    base_scores = {
        'Normal': 10,
        'Bradycardia': 40,
        'Tachycardia': 50,
        'PVC': 70,
        'AFib': 80,
    }
    score = base_scores.get(final_class, 30)
    # Higher CNN confidence on abnormal classes nudges risk up
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
    # Validate input length
    if len(request.signal) != 360:
        raise HTTPException(
            status_code=400,
            detail=f"signal must contain exactly 360 samples, got {len(request.signal)}"
        )

    # Reshape to (1, 360, 1) — the input shape the CNN expects
    x = np.array(request.signal).reshape(1, 360, 1).astype("float32")

    # Run inference
    probs = model.predict(x, verbose=0)[0]
    cnn_idx = int(np.argmax(probs))
    cnn_class = label_encoder.classes_[cnn_idx]
    confidence = float(probs[cnn_idx])

    # Apply full 5-class rule (CNN + BPM)
    final_class, bpm = apply_full_classification(cnn_class, request.rr_interval)

    # CVD risk
    cvd_score, cvd_category = compute_cvd_risk(final_class, confidence)

    return ECGPredictResponse(
        rhythm_class=final_class,
        confidence=round(confidence, 4),
        cnn_class=cnn_class,
        bpm=round(bpm, 1) if bpm is not None else None,
        cvd_risk_score=cvd_score,
        cvd_risk_category=cvd_category
    )