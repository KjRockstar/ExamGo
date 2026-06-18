require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy; needed for express-rate-limit to work correctly
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error('Missing GROQ_API_KEY environment variable. Set it in Render dashboard under Environment.');
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

// ---- Rate limiting: protect your Groq quota from abuse ----
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
// Expects: { subjectName: string, examType: "CAT1"|"CAT2"|"FAT", paperCount: number, pastQuestions: string[] }
app.post('/api/predict', predictionLimiter, async (req, res) => {
  try {
    const { subjectName, examType, paperCount, pastQuestions } = req.body || {};

    if (!subjectName || !examType || !Array.isArray(pastQuestions) || pastQuestions.length === 0) {
      return res.status(400).json({ error: 'subjectName, examType, and a non-empty pastQuestions[] are required.' });
    }

    const validExamTypes = ['CAT1', 'CAT2', 'FAT'];
    if (!validExamTypes.includes(examType)) {
      return res.status(400).json({ error: 'examType must be one of CAT1, CAT2, FAT.' });
    }

    const safeSubject = String(subjectName).slice(0, 200);
    const safePaperCount = Number(paperCount) || pastQuestions.length;
    // Cap how many questions we send to keep prompt size sane, but keep enough for real pattern analysis
    const safeQuestions = pastQuestions.slice(0, 120).map(q => String(q).slice(0, 400));
    const questionsBlock = safeQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');

    const prompt = `You are an expert VIT Chennai exam analyst helping a CSE first-year student prepare for their upcoming ${examType} exam in ${safeSubject}.

Below are the ACTUAL questions that have appeared across ${safePaperCount} real ${examType} papers (different slots, same exam type) for this subject. Your job is to analyze these REAL questions for repeating patterns, frequently tested concepts, and recurring question phrasings — then predict what is likely to appear in the NEXT ${examType} exam, based strictly on these patterns. Do not invent topics that don't appear anywhere in the list below.

ACTUAL PAST QUESTIONS FROM ${examType} PAPERS:
${questionsBlock}

Based on your analysis of the questions above, provide:

🎯 MOST LIKELY QUESTIONS (pick the 3-5 specific questions or close variants from the list above that repeat most often across different slots — quote or closely paraphrase them):
[list them with how many times a similar version appeared]

📋 RECURRING TOPICS RANKED BY FREQUENCY:
[list the topics/concepts you observed repeating, ranked highest to lowest frequency, based only on what's in the questions above]

⚡ LOWER-FREQUENCY BUT POSSIBLE:
[1-2 topics that appeared rarely in the list but could still show up]

💡 PREPARATION STRATEGY:
[2-3 tips specific to what you found in this exact set of papers — e.g. which question part (A/B/C) repeats a specific topic most]

Be concrete and reference the actual patterns you see in the questions above — do not give generic exam advice. Keep the response focused and well-organized.`;

    const groqResponse = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1300,
          temperature: 0.6
        })
      }
    );

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error('Groq API error:', groqResponse.status, errText);
      return res.status(502).json({ error: 'AI provider error. Please try again shortly.' });
    }

    const data = await groqResponse.json();
    const text = data?.choices?.[0]?.message?.content || '';

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
