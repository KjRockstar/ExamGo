const express = require('express');
const { listSubjects, getSubject, getPaper } = require('../data');

const router = express.Router();

// GET /api/subjects — lightweight list for the home page
router.get('/subjects', (req, res) => {
  res.json(listSubjects());
});

// GET /api/subjects/:code — full subject detail including papers + questions
router.get('/subjects/:code', (req, res) => {
  const subject = getSubject(req.params.code);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });
  res.json(subject);
});

// GET /api/papers/:id — a single paper with its questions
router.get('/papers/:id', (req, res) => {
  const paper = getPaper(req.params.id);
  if (!paper) return res.status(404).json({ error: 'Paper not found' });
  res.json(paper);
});

module.exports = router;
