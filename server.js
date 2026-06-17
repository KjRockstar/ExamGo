require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY environment variable. Set it in Render dashboard under Environment.');
}

// ---- CORS: only allow your actual ExamGo site(s) to call this backend ----
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (e.g. curl, server-to-server health checks)
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  }
}));

app.use(express.json({ limit: '100kb' }));

// ---- Rate limiting: protect your Gemini quota from abuse ----
const predictionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,              // 10 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment and try again.' }
});

app.get('/', (req, res) => {
  res.json({ status: 'ExamGo backend is running' });
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// ---- Main prediction endpoint ----
// Expects: { subjectName: string, examType: "CAT1"|"CAT2"|"FAT", topTopics: string[] }
app.post('/api/predict', predictionLimiter, async (req, res) => {
  try {
    const { subjectName, examType, topTopics } = req.body || {};

    if (!subjectName || !examType || !Array.isArray(topTopics)) {
      return res.status(400).json({ error: 'subjectName, examType, and topTopics[] are required.' });
    }

    const validExamTypes = ['CAT1', 'CAT2', 'FAT'];
    if (!validExamTypes.includes(examType)) {
      return res.status(400).json({ error: 'examType must be one of CAT1, CAT2, FAT.' });
    }

    const safeSubject = String(subjectName).slice(0, 200);
    const safeTopics = topTopics.slice(0, 15).map(t => String(t).slice(0, 100)).join(', ');

    const prompt = `You are an expert VIT Chennai exam analyst helping a CSE first-year student. Based on previous year papers for ${safeSubject}, the most frequently tested topics are: ${safeTopics}.

Generate a concise, practical prediction for the ${examType} exam. Format your response clearly with:

TOP 3 LIKELY PART C QUESTIONS (5 marks each):
[List 3 specific questions likely to appear]

TOP 5 PART A TOPICS (2 marks each):
[List 5 topics]

DARK HORSE TOPIC:
[One unexpected topic that could appear based on the pattern]

LAST-MINUTE TIPS:
[2-3 specific revision tips for this exam]

Be specific to VIT Chennai syllabus. Keep it crisp and actionable.`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errText);
      return res.status(502).json({ error: 'AI provider error. Please try again shortly.' });
    }

    const data = await geminiResponse.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';

    if (!text) {
      return res.status(502).json({ error: 'No prediction generated. Please try again.' });
    }

    return res.json({ prediction: text });

  } catch (err) {
    console.error('Prediction endpoint error:', err);
    return res.status(500).json({ error: 'Something went wrong generating your prediction.' });
  }
});

app.listen(PORT, () => {
  console.log(`ExamGo backend listening on port ${PORT}`);
});
