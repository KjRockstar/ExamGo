require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const subjectsRoutes = require('./src/routes/subjects');
const analysisRoutes = require('./src/routes/analysis');

const app = express();
const PORT = process.env.PORT || 3001;

// --- CORS ---
// ALLOWED_ORIGIN can be "*", a single origin, or a comma-separated list.
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
const origins = allowedOrigin === '*' ? '*' : allowedOrigin.split(',').map(o => o.trim());
app.use(cors({ origin: origins }));

app.use(express.json());

// --- Rate limiting on the AI analysis endpoints (they cost real API credits) ---
const analysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many analysis requests, please try again shortly.' },
});
app.use('/api/analysis', analysisLimiter);

// --- Routes ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use('/api', subjectsRoutes);
app.use('/api', analysisRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`ExamGo backend listening on port ${PORT}`);
});
