// ExamGo app logic

const state = {
  view: 'home', // home | pyq-subject | pyq-paper | analysis
  semFilter: 'all', // all | 1 | 2
  examFilter: 'all', // all | CAT1 | CAT2 | FAT
  search: '',
  activeSubject: null,
  activePaper: null,
};

const root = document.getElementById('app');

function setView(view, opts = {}) {
  state.view = view;
  Object.assign(state, opts);
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function examTagClass(type) {
  if (type === 'CAT1') return 'cat1';
  if (type === 'CAT2') return 'cat2';
  return 'fat';
}

// ===== Renderers =====

function renderHeader() {
  return `
    <header class="site-header">
      <div class="header-inner">
        <a href="#" class="brand" data-nav="home">
          <span class="brand-mark">Exam<span>Go</span></span>
          <span class="brand-tag">VIT B.Tech · Sem 1 &amp; 2</span>
        </a>
        <nav class="main-nav">
          <button class="nav-btn ${state.view.startsWith('pyq') || state.view === 'home' ? 'active' : ''}" data-nav="home">PYQ Papers</button>
          <button class="nav-btn ${state.view === 'analysis' ? 'active' : ''}" data-nav="analysis">AI Analysis</button>
        </nav>
      </div>
    </header>
  `;
}

function renderHero() {
  const totalPapers = getAllPapers().length;
  const totalSubjects = SUBJECTS.length;
  return `
    <section class="hero">
      <div>
        <span class="hero-eyebrow">Previous Year Questions, Organized</span>
        <h1>Every CAT and FAT paper, <em>read and indexed</em> — not just scanned.</h1>
        <p>Browse past papers by subject and slot, or jump straight to AI Analysis to see which topics actually get tested — and what's likely to show up next.</p>
        <div class="hero-stats">
          <div>
            <div class="hero-stat-num">${totalSubjects}</div>
            <div class="hero-stat-label">Subjects indexed</div>
          </div>
          <div>
            <div class="hero-stat-num">${totalPapers}</div>
            <div class="hero-stat-label">Papers with full questions</div>
          </div>
          <div>
            <div class="hero-stat-num">2</div>
            <div class="hero-stat-label">Semesters covered</div>
          </div>
        </div>
      </div>
      <div class="reg-card">
        <div class="reg-row"><span class="reg-label">Programme</span><span class="reg-value">B.Tech, All Branches</span></div>
        <div class="reg-row"><span class="reg-label">Semesters</span><span class="reg-value">1 &amp; 2 (2025–2026)</span></div>
        <div class="reg-row"><span class="reg-label">Exam Types</span><span class="reg-value">CAT‑1 · CAT‑2 · FAT</span></div>
        <div class="reg-row"><span class="reg-label">Status</span><span class="reg-value" style="color:var(--green-ok)">Indexed &amp; Ready</span></div>
        <div class="reg-flag"><strong>Note —</strong> question text is fully structured for Sem 1 subjects and BMAT202L/BACHY105 etc. carry topic-level data only; see each subject page for details.</div>
      </div>
    </section>
  `;
}

function renderSubjectCard(s) {
  const paperCount = (s.papers || []).length;
  const hasFullData = paperCount > 0;
  return `
    <div class="subject-card" style="--card-accent:${s.color}" data-nav="subject" data-code="${s.code}">
      <div class="subject-card-top">
        <span class="subject-code">${s.code}</span>
        <span class="subject-sem-badge">Sem ${s.semester}</span>
      </div>
      <h3>${s.name}</h3>
      <div class="subject-card-meta">
        <span>${s.school}</span>
        <strong>${hasFullData ? paperCount + ' papers' : 'Topics only'}</strong>
      </div>
    </div>
  `;
}

function renderHome() {
  let subjects = SUBJECTS.filter(s => {
    if (state.semFilter !== 'all' && String(s.semester) !== state.semFilter) return false;
    if (state.search) {
      const q = state.search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
    }
    return true;
  });

  const sem1 = subjects.filter(s => s.semester === 1);
  const sem2 = subjects.filter(s => s.semester === 2);

  return `
    ${renderHero()}
    <section class="section" id="pyq-section">
      <div class="section-head">
        <div>
          <span class="section-eyebrow">PYQ Library</span>
          <h2>Browse by subject</h2>
          <p>Pick a subject to see every CAT and FAT paper on file, organized by slot.</p>
        </div>
      </div>
      <div class="filter-bar">
        <input type="text" class="search-input" placeholder="Search subject name or code…" value="${escapeHtml(state.search)}" id="subject-search" />
        <div class="filter-group">
          <button class="chip ${state.semFilter === 'all' ? 'active' : ''}" data-filter="sem" data-value="all">All Semesters</button>
          <button class="chip ${state.semFilter === '1' ? 'active' : ''}" data-filter="sem" data-value="1">Semester 1</button>
          <button class="chip ${state.semFilter === '2' ? 'active' : ''}" data-filter="sem" data-value="2">Semester 2</button>
        </div>
      </div>
      ${subjects.length === 0 ? renderEmpty('No subjects match your search.') : `
        ${sem1.length ? `<div class="analysis-subtab-label" style="margin-top:0">Semester 1</div><div class="subject-grid">${sem1.map(renderSubjectCard).join('')}</div>` : ''}
        ${sem2.length ? `<div class="analysis-subtab-label">Semester 2</div><div class="subject-grid">${sem2.map(renderSubjectCard).join('')}</div>` : ''}
      `}
    </section>
  `;
}

function renderEmpty(msg) {
  return `<div class="empty-state"><div class="empty-state-icon">—</div><p>${msg}</p></div>`;
}

function renderSubjectDetail() {
  const s = getSubject(state.activeSubject);
  if (!s) return renderEmpty('Subject not found.');

  let papers = (s.papers || []).filter(p => {
    if (state.examFilter !== 'all' && p.examType !== state.examFilter) return false;
    return true;
  });

  const examTypes = [...new Set((s.papers || []).map(p => p.examType))];

  return `
    <section class="section">
      <button class="back-link" data-nav="home">← All subjects</button>
      <div class="subject-detail-head">
        <div style="flex:1">
          <span class="subject-code" style="color:${s.color}">${s.code} · Sem ${s.semester}</span>
          <h2>${s.name}</h2>
          <div class="meta-line">${s.school}</div>
        </div>
      </div>

      ${papers.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">—</div>
          <p>${s.note || 'No structured paper text on file for this subject yet — only topic-level data is available below.'}</p>
        </div>
      ` : `
        <div class="filter-bar">
          <div class="filter-group">
            <button class="chip ${state.examFilter === 'all' ? 'active' : ''}" data-filter="exam" data-value="all">All Types</button>
            ${examTypes.map(t => `<button class="chip ${state.examFilter === t ? 'active' : ''}" data-filter="exam" data-value="${t}">${t}</button>`).join('')}
          </div>
        </div>
        <div class="paper-list">
          ${papers.map(p => `
            <div class="paper-row" data-nav="paper" data-id="${p.id}">
              <span class="exam-tag ${examTagClass(p.examType)}">${p.examType}</span>
              <div class="paper-row-info">
                <div class="slot">Slot ${p.slot}</div>
                <div class="faculty">${p.faculty} · ${p.semType}</div>
              </div>
              <div class="paper-row-marks">${p.marks} marks<br/>${p.duration}</div>
              <span class="view-arrow">→</span>
            </div>
          `).join('')}
        </div>
      `}

      <div class="analysis-subtab-label">Topic weightage for this subject</div>
      ${renderWeightageBars(s.topicWeightage)}
    </section>
  `;
}

function renderWeightageBars(topics) {
  if (!topics || !topics.length) return renderEmpty('No weightage data yet.');
  return `
    <div>
      ${topics.map(t => `
        <div class="weightage-bar-row">
          <div>
            <div class="weightage-topic">${t.topic}</div>
            <span class="weightage-freq">${t.frequency}</span>
          </div>
          <div class="weightage-track"><div class="weightage-fill" style="width:${t.weight}%"></div></div>
          <div class="weightage-pct">${t.weight}%</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPaperDetail() {
  const all = getAllPapers();
  const p = all.find(x => x.id === state.activePaper);
  if (!p) return renderEmpty('Paper not found.');
  const s = getSubject(p.subjectCode);

  return `
    <section class="section">
      <button class="back-link" data-nav="subject" data-code="${p.subjectCode}">← ${p.subjectCode} papers</button>
      <div class="paper-sheet">
        <div class="paper-sheet-header">
          <span class="label">${s.school}</span>
          <div class="paper-sheet-title">${p.subjectCode} — ${p.examType}, Slot ${p.slot}</div>
          <div class="paper-meta-grid">
            <div>Subject<strong>${s.name}</strong></div>
            <div>Faculty<strong>${p.faculty}</strong></div>
            <div>Semester<strong>${p.semType}</strong></div>
            <div>Marks / Duration<strong>${p.marks} · ${p.duration}</strong></div>
          </div>
          <div class="view-pdf-note">
            ${p.hasAnswerKey ? '<strong>Answer key available —</strong> this paper includes a worked solution scheme extracted alongside the questions.' : '<strong>Original PDF —</strong> this paper was read from an uploaded scan/photo. Structured question text below is the indexed version; re-upload the source PDF to this project to enable inline PDF preview.'}
          </div>
        </div>
        <div class="qlist">
          ${p.questions.map((q, i) => `
            <div class="qrow">
              <div class="qnum">${i + 1}</div>
              <div class="qtext">${q.q}</div>
              <div class="qmeta">
                <span class="marks">${q.marks}M</span>
                <span class="co-bl">${q.co !== '—' ? 'CO ' + q.co : ''} ${q.bl !== '—' ? '· ' + q.bl : ''}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderAnalysis() {
  let subjects = SUBJECTS.filter(s => state.semFilter === 'all' || String(s.semester) === state.semFilter);

  return `
    <section class="section" style="padding-top:40px">
      <div class="ai-banner">
        <span class="ai-banner-eyebrow">AI Analysis</span>
        <h2>What's actually likely to show up next.</h2>
        <p>Built by reading every available CAT and FAT paper per subject and finding which topics, question formats, and phrasings repeat across slots and faculty. Weightage reflects how consistently a topic appears — not difficulty.</p>
      </div>

      <div class="filter-bar">
        <div class="filter-group">
          <button class="chip ${state.semFilter === 'all' ? 'active' : ''}" data-filter="sem" data-value="all">All Semesters</button>
          <button class="chip ${state.semFilter === '1' ? 'active' : ''}" data-filter="sem" data-value="1">Semester 1</button>
          <button class="chip ${state.semFilter === '2' ? 'active' : ''}" data-filter="sem" data-value="2">Semester 2</button>
        </div>
      </div>

      ${subjects.map(s => `
        <div class="analysis-subject-block">
          <div class="analysis-subject-block-head">
            <span class="subject-code" style="color:${s.color}">${s.code}</span>
            <h3>${s.name}</h3>
          </div>

          <div class="analysis-subtab-label" style="margin-top:22px">Topic weightage (based on recurrence across papers)</div>
          ${renderWeightageBars(s.topicWeightage)}

          <div class="analysis-subtab-label">Predicted important for next exam</div>
          <ul class="predicted-list">
            ${(s.predictedImportant || []).map((item, i) => `
              <li class="predicted-item">
                <span class="flag-num">${String(i + 1).padStart(2, '0')}</span>
                <span>${item}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `).join('')}
    </section>
  `;
}

function render() {
  let body = '';
  if (state.view === 'home') body = renderHome();
  else if (state.view === 'pyq-subject') body = renderSubjectDetail();
  else if (state.view === 'pyq-paper') body = renderPaperDetail();
  else if (state.view === 'analysis') body = renderAnalysis();

  root.innerHTML = `
    ${renderHeader()}
    ${body}
    <footer class="site-footer">
      <div class="footer-inner">
        <span>ExamGo · Built from indexed VIT past papers</span>
        <span>Sem 1 &amp; Sem 2 · 2025–2026</span>
      </div>
    </footer>
  `;

  attachEvents();
}

function attachEvents() {
  root.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const nav = el.dataset.nav;
      if (nav === 'home') setView('home');
      else if (nav === 'analysis') setView('analysis');
      else if (nav === 'subject') setView('pyq-subject', { activeSubject: el.dataset.code, examFilter: 'all' });
      else if (nav === 'paper') setView('pyq-paper', { activePaper: el.dataset.id });
    });
  });

  root.querySelectorAll('[data-filter="sem"]').forEach(el => {
    el.addEventListener('click', () => {
      state.semFilter = el.dataset.value;
      render();
    });
  });

  root.querySelectorAll('[data-filter="exam"]').forEach(el => {
    el.addEventListener('click', () => {
      state.examFilter = el.dataset.value;
      render();
    });
  });

  const searchInput = document.getElementById('subject-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.search = e.target.value;
      render();
      document.getElementById('subject-search').focus();
      const val = document.getElementById('subject-search').value;
      document.getElementById('subject-search').setSelectionRange(val.length, val.length);
    });
  }
}

render();
