// Gateway main entry point
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const ecgRoutes = require('./src/routes/ecgRoutes');
const { router: authRoutes } = require('./src/routes/authRoutes');
const { router: patientAuthRoutes } = require('./src/routes/patientAuthRoutes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));  // ECG signals can be larger than default

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'ECG Gateway' });
});

// Mount the ECG routes
app.use('/api/v1/ecg', ecgRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/patient-auth', patientAuthRoutes);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✓ ECG Gateway listening on http://localhost:${PORT}`);
  console.log(`  AI service URL: ${process.env.AI_SERVICE_URL}`);
});