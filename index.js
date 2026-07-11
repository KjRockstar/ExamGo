const SUBJECTS = require('./subjects.json');

function listSubjects() {
  // Lightweight version for the subjects list endpoint — no question text.
  return SUBJECTS.map(s => ({
    code: s.code,
    name: s.name,
    semester: s.semester,
    school: s.school,
    color: s.color,
    paperCount: (s.papers || []).length,
    hasFullPapers: (s.papers || []).length > 0,
    note: s.note || null,
  }));
}

function getSubject(code) {
  return SUBJECTS.find(s => s.code.toLowerCase() === String(code).toLowerCase());
}

function getAllPapers() {
  const all = [];
  SUBJECTS.forEach(s => {
    (s.papers || []).forEach(p => {
      all.push({ ...p, subjectCode: s.code, subjectName: s.name, subjectColor: s.color, semester: s.semester });
    });
  });
  return all;
}

function getPaper(id) {
  return getAllPapers().find(p => p.id === id);
}

module.exports = { SUBJECTS, listSubjects, getSubject, getAllPapers, getPaper };
