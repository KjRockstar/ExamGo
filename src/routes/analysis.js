const express = require('express');
const { getSubject, SUBJECTS } = require('../data');
const { getAnalysis, getCacheStatus } = require('../services/aiAnalysis');

const router = express.Router();

// GET /api/analysis/:code — cached (or freshly generated) AI analysis for one subject
router.get('/analysis/:code', async (req, res) => {
  const code = req.params.code.toUpperCase();
  if (!getSubject(code)) return res.status(404).json({ error: 'Subject not found' });

  try {
    const result = await getAnalysis(code);
    res.json({ code, ...result });
  } catch (err) {
    console.error(`Analysis generation failed for ${code}:`, err.message);
    res.status(502).json({ error: 'AI analysis generation failed', detail: err.message });
  }
});

// POST /api/analysis/:code/refresh — force regenerate, bypassing cache
// Optionally protected by ADMIN_TOKEN env var to prevent random visitors burning API credits.
router.post('/analysis/:code/refresh', async (req, res) => {
  const adminToken = process.env.ADMIN_TOKEN;
  if (adminToken && req.get('x-admin-token') !== adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const code = req.params.code.toUpperCase();
  if (!getSubject(code)) return res.status(404).json({ error: 'Subject not found' });

  try {
    const result = await getAnalysis(code, { force: true });
    res.json({ code, ...result });
  } catch (err) {
    console.error(`Analysis refresh failed for ${code}:`, err.message);
    res.status(502).json({ error: 'AI analysis generation failed', detail: err.message });
  }
});

// GET /api/analysis — status of what's cached (debugging/admin use)
router.get('/analysis', (req, res) => {
  res.json({
    subjects: SUBJECTS.map(s => s.code),
    cache: getCacheStatus(),
  });
});

module.exports = router;
