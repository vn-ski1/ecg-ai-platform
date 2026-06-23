# ECG AI Platform

> Cloud-native ECG analysis platform with hospital integration, 1D-CNN arrhythmia detection, CVD risk prediction, and real-time physician alerts.

**Final-year B.Tech project** · Institut Universitaire de la Côte (IUC), Douala, Cameroon
School of Engineering and Applied Science · Full-Stack Development

---

## Overview

A complete healthcare integration platform that connects existing hospital ECG equipment to an AI processing pipeline. When a hospital uploads an ECG signal, the platform automatically:

1. Authenticates the hospital via API key
2. Forwards the signal to a 1D Convolutional Neural Network for arrhythmia classification
3. Combines CNN output with a heart-rate rule to detect Bradycardia and Tachycardia
4. Computes a cardiovascular disease (CVD) risk score on a 0–100 scale
5. Persists the analysis in PostgreSQL
6. If risk is HIGH (≥67), dispatches an SMS alert to the assigned physician via Twilio within 5 seconds
7. Sends bilingual (English + French) status SMS to the patient

End-to-end latency: under 5 seconds from hospital upload to physician alert.

## Architecture

A 5-layer cloud-native architecture:

| Layer | Component | Tech |
|---|---|---|
| L1 — Acquisition | Hospital ECG equipment (simulated by `test-upload.js`) | HTTP client |
| L2 — Gateway | Authentication, routing, persistence orchestration | Node.js + Express |
| L3 — AI Engine | 1D-CNN inference + BPM rule + CVD scoring | Python + FastAPI + TensorFlow |
| L4 — Storage & Alerts | Data persistence, alert dispatch | PostgreSQL + Twilio SMS |
| L5 — Presentation | Doctor dashboard + Patient portal + Public homepage | React + Vite + Recharts |

## Key Features

- 1D-CNN trained on the MIT-BIH Arrhythmia Database (3-class: AFib, Normal, PVC)
- 96.4% weighted F1-score on held-out test set
- BPM-based rule layer adds Bradycardia / Tachycardia detection from RR intervals
- JWT authentication for doctors and patients (separate flows)
- Doctor dashboard with patient list, search, filter by risk, sortable table, risk-distribution donut chart, full ECG waveform visualization
- Alerts page with status tracking (Pending Resolution / Resolved) and acknowledge action
- Patient portal with personal CVD risk history and active alerts
- Real-time Twilio SMS dispatch in English and French
- Light and dark mode UI
- Public homepage explaining the architecture for hospital stakeholders

## Tech Stack

**Backend**
- Python 3.12, FastAPI, TensorFlow 2.21, scikit-learn (AI Engine)
- Node.js 22, Express, pg, bcrypt, jsonwebtoken, Twilio SDK (Gateway)
- PostgreSQL 14 (Data layer)

**Frontend**
- React 19, Vite, React Router, Axios, Recharts

**External services**
- Twilio (SMS dispatch to Cameroonian +237 numbers)

## Running Locally

### Prerequisites
- Python 3.12, Node.js 22, PostgreSQL 14
- Twilio account with verified phone numbers (free trial works)

### Setup

**1. Database**
```sql
CREATE DATABASE ecg_platform;
-- Then run the schema and seed scripts (see gateway/seed-demo-data.js)
```

**2. AI service**