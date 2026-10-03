/* ============ CONFIG (edit here) ============ */
const GRADE_SCALE = [            // must be sorted high → low
  { min: 90, grade: 'A+', point: 4.0 },
  { min: 80, grade: 'A',  point: 4.0 },
  { min: 70, grade: 'B+', point: 3.5 },
  { min: 60, grade: 'B',  point: 3.0 },
  { min: 50, grade: 'C',  point: 2.0 },
  { min: 40, grade: 'D',  point: 1.0 },
  { min: 0,  grade: 'F',  point: 0.0 }
];
const PERFORMANCE = [[90,'Outstanding'],[80,'Excellent'],[70,'Very Good'],[60,'Good'],[50,'Average'],[40,'Needs Improvement'],[0,'Poor']];
const PASS_PERCENT = 40;         // minimum % to pass a subject / overall
const STORE = 'emc_data', THEME = 'emc_theme', THEME_PRESET = 'emc_theme_preset';
const THEME_PRESETS = {
  rose: { label: 'Rose', accent: '#b91c1c' },
  classic: { label: 'Classic', accent: '#2563eb' },
  midnight: { label: 'Midnight', accent: '#7c3aed' }
};

/* ============ STATE & HELPERS ============ */
let subjects = [];
let sems = [];                   // CGPA semesters
let last = null;                 // last valid result
const boardData = {
  matric: { subjects: [newBoardSubject()] },
  fsc: { subjects: [newBoardSubject()] }
};
const $ = id => document.getElementById(id);
const INFO = ['sName','sFather','sRoll','sClass','sExam','sDate','sSchool','sCollege','sYear','sFscPart','sUniversity','sDepartment'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => (Math.round(n * 100) / 100).toString();
const newSubject = () => ({ name: '', obt: '', tot: '100', cr: '' });

function toast(msg) {
  const t = $('toast'); t.textContent = msg;
  t.classList.remove('opacity-0', 'translate-y-6');
  clearTimeout(toast.id);
  toast.id = setTimeout(() => t.classList.add('opacity-0', 'translate-y-6'), 2400);
}

/* ============ CALCULATION LOGIC ============ */
function calculatePercentage(obt, tot) { return tot > 0 ? (obt / tot) * 100 : 0; }
function calculateGrade(pct) { return GRADE_SCALE.find(g => pct >= g.min) || GRADE_SCALE[GRADE_SCALE.length - 1]; }
function performanceOf(pct) { return (PERFORMANCE.find(p => pct >= p[0]) || PERFORMANCE[PERFORMANCE.length - 1])[1]; }
// GPA = Σ(grade point × credits) / Σ(credits); blank credits count as 1
function calculateGPA(list) {
  let pts = 0, cr = 0;
  list.forEach(s => { pts += s.point * s.cr; cr += s.cr; });
  return cr > 0 ? pts / cr : 0;
}

// Validate one subject; returns error string or ''
function validateSubject(s) {
  const has = s.obt !== '' || s.name.trim() !== '';
  if (!has) return 'Enter a subject name and marks.';
  if (s.name.trim() === '') return 'Please enter a subject name.';
  if (s.obt === '' || isNaN(+s.obt)) return 'Enter the obtained marks.';
  if (s.tot === '' || isNaN(+s.tot) || +s.tot <= 0) return 'Total marks must be greater than 0.';
  if (+s.obt < 0) return 'Marks cannot be negative.';
  if (+s.obt > +s.tot) return 'Obtained marks cannot exceed total marks.';
  if (s.cr !== '' && (isNaN(+s.cr) || +s.cr < 0)) return 'Credit hours cannot be negative.';
  return '';
}

function calculateResults(showErrors = false) {
  const valid = []; let errCount = 0;
  const rows = document.querySelectorAll('#rows .row');
  subjects.forEach((s, i) => {
    const err = validateSubject(s);
    const untouched = s.name.trim() === '' && s.obt === '';
    const row = rows[i];
    const showErr = err && !untouched;
    if (err) errCount++;
    if (row) {
      row.classList.toggle('invalid', !!err && !untouched);
      row.querySelectorAll('input').forEach(inp => inp.classList.toggle('invalid', !!err && !untouched));
      row.querySelector('.err').textContent = showErr ? err : '';
      row.querySelector('.err').classList.toggle('hidden', !showErr);
    }
    if (!err) {
      const obt = +s.obt, tot = +s.tot, pct = calculatePercentage(obt, tot), g = calculateGrade(pct);
      valid.push({ name: s.name.trim(), obt, tot, pct, grade: g.grade, point: g.point, cr: s.cr === '' ? 1 : +s.cr, pass: pct >= PASS_PERCENT });
      if (row) fillRow(row, pct, g.grade, pct >= PASS_PERCENT);
    } else if (row) fillRow(row, null);
  });

  const box = $('errBox');
  const realErrors = subjects.filter(s => {
    const untouched = s.name.trim() === '' && s.obt === '';
    return !untouched && !!validateSubject(s);
  }).length;
  box.classList.toggle('hidden', !realErrors);
  box.innerHTML = realErrors ? '<i class="fa-solid fa-triangle-exclamation mr-2"></i>' + realErrors + ' subject(s) have issues. Results below only include valid subjects.' : '';

  if (!valid.length) { last = null; renderResults(null); return { ok: false, errors: realErrors }; }
  const totalObt = valid.reduce((a, s) => a + s.obt, 0), totalMax = valid.reduce((a, s) => a + s.tot, 0);
  const pct = calculatePercentage(totalObt, totalMax), passed = valid.filter(s => s.pass).length;
  const byObt = [...valid].sort((a, b) => b.obt - a.obt);
  last = {
    list: valid, totalObt, totalMax, pct, avg: totalObt / valid.length, gpa: calculateGPA(valid),
    grade: calculateGrade(pct).grade, passed, failed: valid.length - passed,
    high: byObt[0], low: byObt[byObt.length - 1], perf: performanceOf(pct),
    status: (passed === valid.length && pct >= PASS_PERCENT) ? 'Pass' : 'Fail'
  };
  renderResults(last);
  return { ok: !realErrors, errors: realErrors };
}

/* ============ RENDERING ============ */
function fillRow(row, pct, grade, pass) {
  row.querySelector('.r-pct').textContent = pct === null ? '—' : fmt(pct) + '%';
  row.querySelector('.r-grade').textContent = pct === null ? '—' : grade;
  const st = row.querySelector('.r-status');
  st.textContent = pct === null ? '—' : (pass ? 'Pass' : 'Fail');
  st.className = 'badge r-status ' + (pct === null ? '' : pass ? 'pass' : 'fail');
}

function renderRows() {
  $('rows').innerHTML = subjects.map((s, i) => `
    <div class="row sub fade" data-i="${i}">
      <div class="grid grid-cols-2 items-end gap-3 md:grid-cols-12">
        <div class="col-span-2 md:col-span-3"><label class="lbl md:sr-only">Subject</label><input data-f="name" class="inp" placeholder="Subject name" value="${esc(s.name)}"></div>
        <div class="md:col-span-2"><label class="lbl md:sr-only">Obtained</label><input data-f="obt" type="number" min="0" step="any" inputmode="decimal" class="inp" placeholder="Obtained" value="${esc(s.obt)}"></div>
        <div class="md:col-span-2"><label class="lbl md:sr-only">Total</label><input data-f="tot" type="number" min="1" step="any" inputmode="decimal" class="inp" placeholder="Total" value="${esc(s.tot)}"></div>
        <div class="md:col-span-1"><label class="lbl md:sr-only">Credits</label><input data-f="cr" type="number" min="0" step="any" inputmode="decimal" class="inp" placeholder="Credits" value="${esc(s.cr)}"></div>
        <div class="col-span-2 flex items-center justify-between gap-2 md:col-span-4 md:grid md:grid-cols-4">
          <span class="r-pct text-sm font-semibold">—</span>
          <span class="r-grade text-sm font-bold">—</span>
          <span class="badge r-status">—</span>
          <button data-del class="justify-self-end rounded-lg p-2 text-neutral-500 transition hover:text-red-600" aria-label="Remove subject"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>
      <p class="err mt-2 hidden text-xs font-medium text-red-600 dark:text-red-400"></p>
    </div>`).join('');
}

function renderResults(r) {
  const dash = '—';
  const v = r ? {
    total: fmt(r.totalMax), obt: fmt(r.totalObt), pct: fmt(r.pct) + '%', avg: fmt(r.avg), gpa: r.gpa.toFixed(2), grade: r.grade,
    passed: r.passed, failed: r.failed, high: fmt(r.high.obt) + '/' + fmt(r.high.tot), low: fmt(r.low.obt) + '/' + fmt(r.low.tot), status: r.status
  } : {};
  const defs = [
    ['Total Marks','total','fa-layer-group'],['Obtained Marks','obt','fa-pen-to-square'],['Percentage','pct','fa-percent'],['Average','avg','fa-scale-balanced'],
    ['GPA','gpa','fa-award'],['Grade','grade','fa-medal'],['Passed','passed','fa-circle-check'],['Failed','failed','fa-circle-xmark'],
    ['Highest Marks','high','fa-arrow-trend-up'],['Lowest Marks','low','fa-arrow-trend-down'],['Result Status','status','fa-flag-checkered']
  ];
  $('cards').innerHTML = defs.map(d => `
    <div class="stat"><div class="mb-2 flex items-center justify-between text-neutral-500"><span class="text-xs font-medium">${d[0]}</span><i class="fa-solid ${d[2]}"></i></div>
    <div class="text-2xl font-bold">${v[d[1]] ?? dash}</div></div>`).join('');
  const pct = r ? r.pct : 0;
  $('ringPct').textContent = r ? fmt(pct) + '%' : '0%';
  $('ring').style.strokeDashoffset = 326.7 * (1 - Math.min(pct, 100) / 100);
  $('bar').style.width = Math.min(pct, 100) + '%';
  $('perfMsg').textContent = r ? r.perf : dash;
  $('summary').textContent = r
    ? `${r.list.length} subject(s): ${r.passed} passed, ${r.failed} failed. Overall grade ${r.grade} with GPA ${r.gpa.toFixed(2)}.`
    : 'Enter marks to see your result.';
  renderSubjectChart(r);
}

function boardGrade(pct) {
  if (pct >= 80) return 'A+';
  if (pct >= 70) return 'A';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

function validateBoardSubject(subject) {
  const name = (subject.name || '').trim();
  const obtained = subject.obtained ?? '';
  const total = subject.total ?? '100';
  const hasInput = name !== '' || obtained !== '' || (total !== '' && total !== '100');
  if (!hasInput) return '';
  if (name === '') return 'Please enter a subject name.';
  if (obtained === '' || isNaN(+obtained)) return 'Enter the obtained marks.';
  if (total === '' || isNaN(+total) || Number(total) <= 0) return 'Total marks must be greater than 0.';
  if (+obtained < 0) return 'Marks cannot be negative.';
  if (+obtained > +total) return 'Obtained marks cannot exceed total marks.';
  return '';
}

function newBoardSubject() { return { name: '', obtained: '', total: '100' }; }

function renderBoardRows(type) {
  const rows = boardData[type].subjects;
  const container = document.getElementById(type + 'Rows');
  if (!container) return;
  container.innerHTML = rows.map((subject, idx) => {
    const value = validateBoardSubject(subject);
    const hasValue = (subject.name || '').trim() !== '' || subject.obtained !== '' || (subject.total !== '' && subject.total !== '100');
    const pct = hasValue && !value ? Number(subject.obtained || 0) / (Number(subject.total || 100) || 1) * 100 : null;
    const grade = pct === null ? '—' : boardGrade(pct);
    const statusText = pct === null ? '—' : (pct >= PASS_PERCENT ? 'Pass' : 'Fail');
    const statusClass = pct === null ? '' : pct >= PASS_PERCENT ? 'pass' : 'fail';
    return `
      <div class="board-row ${subject.name || subject.obtained || subject.total ? '' : ''}" data-board-row="${idx}">
        <div class="board-grid">
          <div class="board-field"><label class="lbl">Subject</label><input data-board-field="name" data-board-type="${type}" data-index="${idx}" class="inp" placeholder="e.g. Math" value="${esc(subject.name)}"></div>
          <div class="board-field"><label class="lbl">Obtained</label><input data-board-field="obtained" data-board-type="${type}" data-index="${idx}" type="number" min="0" step="any" inputmode="decimal" class="inp" placeholder="0" value="${esc(subject.obtained)}"></div>
          <div class="board-field"><label class="lbl">Total</label><input data-board-field="total" data-board-type="${type}" data-index="${idx}" type="number" min="1" step="any" inputmode="decimal" class="inp" placeholder="100" value="${esc(subject.total)}"></div>
          <div class="board-field"><label class="lbl">%</label><div class="board-metric board-pct">${pct === null ? '—' : fmt(pct) + '%'}</div></div>
          <div class="board-field"><label class="lbl">Grade</label><div class="board-metric board-grade">${grade}</div></div>
          <div class="board-field"><label class="lbl">Status</label><div class="board-metric"><span class="badge board-status ${statusClass}">${statusText}</span></div></div>
          <div class="board-action"><button type="button" class="board-remove" data-board-remove="${type}" data-index="${idx}" aria-label="Remove subject"><i class="fa-solid fa-xmark"></i></button></div>
        </div>
        <p class="board-err mt-2 hidden text-xs font-medium text-red-600 dark:text-red-400"></p>
      </div>
    `;
  }).join('');
}

function addBoardSubject(type) {
  boardData[type].subjects.push(newBoardSubject());
  renderBoardRows(type);
  saveData();
}

function removeBoardSubject(type, idx = boardData[type].subjects.length - 1) {
  if (boardData[type].subjects.length <= 1) return toast('At least one subject is required.');
  boardData[type].subjects.splice(idx, 1);
  renderBoardRows(type);
  calculateBoardResult(type);
  saveData();
}

function calculateBoardResult(type) {
  const state = boardData[type];
  const rows = document.querySelectorAll(`#${type}Rows .board-row`);
  let totalObt = 0, totalMax = 0, validSubjects = 0;
  let hasIssue = false;
  const reportSubjects = [];
  state.subjects.forEach((subject, idx) => {
    const row = rows[idx];
    const hasInput = ((subject.name || '').trim() !== '' || subject.obtained !== '' || (subject.total !== '' && subject.total !== '100'));
    const err = hasInput ? validateBoardSubject(subject) : '';
    if (row) {
      const errEl = row.querySelector('.board-err');
      const hasErr = !!err;
      row.classList.toggle('invalid', hasErr);
      row.querySelectorAll('input').forEach(input => input.classList.toggle('invalid', hasErr));
      if (errEl) {
        errEl.textContent = err || '';
        errEl.classList.toggle('hidden', !hasErr);
      }
      const pct = !err && hasInput ? Number(subject.obtained || 0) / (Number(subject.total || 100) || 1) * 100 : null;
      const pctEl = row.querySelector('.board-pct');
      const gradeEl = row.querySelector('.board-grade');
      const statusEl = row.querySelector('.board-status');
      if (pctEl) pctEl.textContent = pct === null ? '—' : fmt(pct) + '%';
      if (gradeEl) gradeEl.textContent = pct === null ? '—' : boardGrade(pct);
      if (statusEl) {
        statusEl.textContent = pct === null ? '—' : (pct >= PASS_PERCENT ? 'Pass' : 'Fail');
        statusEl.className = 'badge board-status ' + (pct === null ? '' : pct >= PASS_PERCENT ? 'pass' : 'fail');
      }
    }
    if (!err && hasInput) {
      const obtained = Number(subject.obtained), total = Number(subject.total || 100);
      const percentage = total > 0 ? (obtained / total) * 100 : 0;
      reportSubjects.push({
        name: subject.name.trim(),
        obtained,
        total,
        percentage,
        grade: boardGrade(percentage),
        pass: percentage >= PASS_PERCENT
      });
      totalObt += obtained;
      totalMax += total;
      validSubjects += 1;
    }
    if (err && hasInput) hasIssue = true;
  });

  const resultBox = document.getElementById(type + 'Result');
  if (!validSubjects) {
    resultBox.innerHTML = '<div class="board-empty">Enter valid subject marks to calculate.</div>';
    return { ok: false, errors: hasIssue };
  }

  const percentage = totalMax > 0 ? (totalObt / totalMax) * 100 : 0;
  const avg = validSubjects ? totalObt / validSubjects : 0;
  const grade = boardGrade(percentage);
  const summary = {
    totalObtained: totalObt,
    totalMax,
    percentage,
    average: avg,
    grade,
    subjectCount: validSubjects,
    status: percentage >= PASS_PERCENT ? 'Pass' : 'Fail',
    subjects: reportSubjects
  };

  resultBox.innerHTML = `
    <div class="board-overall ${summary.status.toLowerCase()}">
      <div class="board-overall-icon"><i class="fa-solid ${summary.status === 'Pass' ? 'fa-circle-check' : 'fa-circle-xmark'}"></i></div>
      <div><span>Overall Result</span><strong>${summary.status}</strong></div>
      <p>${summary.subjectCount} valid subject(s) · ${summary.status === 'Pass' ? 'Congratulations on passing.' : 'Overall percentage is below the pass mark.'}</p>
    </div>
    <div class="board-stats-grid">
      <div class="board-summary-card"><span><i class="fa-solid fa-pen-to-square"></i> Obtained Marks</span><strong>${fmt(summary.totalObtained)}</strong></div>
      <div class="board-summary-card"><span><i class="fa-solid fa-bullseye"></i> Total Marks</span><strong>${fmt(summary.totalMax)}</strong></div>
      <div class="board-summary-card"><span><i class="fa-solid fa-percent"></i> Percentage</span><strong>${fmt(summary.percentage)}%</strong></div>
      <div class="board-summary-card"><span><i class="fa-solid fa-scale-balanced"></i> Average</span><strong>${fmt(summary.average)}</strong></div>
      <div class="board-summary-card"><span><i class="fa-solid fa-medal"></i> Overall Grade</span><strong>${summary.grade}</strong></div>
    </div>
  `;
  return { ok: !hasIssue, summary };
}

function buildBoardReport(type, summary) {
  const title = type === 'matric' ? 'Matric Result Sheet' : 'FSc Result Sheet';
  const rows = summary.subjects.map(subject => `
    <tr>
      <td>${esc(subject.name)}</td>
      <td>${fmt(subject.obtained)}</td>
      <td>${fmt(subject.total)}</td>
      <td>${fmt(subject.percentage)}%</td>
      <td>${subject.grade}</td>
      <td class="${subject.pass ? 'report-pass' : 'report-fail'}">${subject.pass ? 'Pass' : 'Fail'}</td>
    </tr>`).join('');
  const student = id => esc($(id).value) || '—';
  return `
    <div class="board-report">
      <header class="board-report-head">
        <div class="board-report-brand">
          <img src="logo.png" alt="Exam Marks Calculator logo">
          <div><span>Pakistan Board Examination</span><h1>${title}</h1></div>
        </div>
        <div class="board-report-result ${summary.status.toLowerCase()}">${summary.status}</div>
      </header>
      <section class="board-report-student">
        <div><span>Student Name</span><strong>${student('sName')}</strong></div>
        <div><span>Roll Number</span><strong>${student('sRoll')}</strong></div>
        <div><span>Class / Semester</span><strong>${student('sClass')}</strong></div>
        <div><span>Examination</span><strong>${student('sExam')}</strong></div>
        <div><span>Date</span><strong>${student('sDate')}</strong></div>
      </section>
      <table class="board-report-table">
        <thead><tr><th>Subject</th><th>Obtained</th><th>Total</th><th>Percentage</th><th>Grade</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <section class="board-report-summary">
        <div><span>Obtained Marks</span><strong>${fmt(summary.totalObtained)}</strong></div>
        <div><span>Total Marks</span><strong>${fmt(summary.totalMax)}</strong></div>
        <div><span>Overall Percentage</span><strong>${fmt(summary.percentage)}%</strong></div>
        <div><span>Average Marks</span><strong>${fmt(summary.average)}</strong></div>
        <div><span>Overall Grade</span><strong>${summary.grade}</strong></div>
      </section>
      <footer class="board-report-footer">Generated by Tariq Jameel · Exam Marks Calculator</footer>
    </div>`;
}

function printBoardResult(type) {
  const result = calculateBoardResult(type);
  if (!result.summary || result.errors) {
    toast(result.errors ? 'Please fix highlighted subject errors before printing.' : 'Enter valid marks before printing.');
    return;
  }
  $('report').innerHTML = buildBoardReport(type, result.summary);
  window.print();
}

function pdfDocument() {
  const JsPDF = window.jspdf && window.jspdf.jsPDF;
  if (!JsPDF || !JsPDF.API || typeof JsPDF.API.autoTable !== 'function') {
    throw new Error('PDF library did not load. Check your internet connection and try again.');
  }
  return new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
}

function openPrintWindow(title, html) {
  const win = window.open('', '_blank', 'width=1200,height=1000');
  if (!win) {
    toast('Please allow pop-ups to open the printable PDF report.');
    return false;
  }
  win.opener = null;
  const styles = `
    <style>
      html, body { margin: 0; padding: 0; background: #fff; color: #111827; }
      body { font-family: Arial, sans-serif; padding: 28px 24px 40px; }
      * { box-sizing: border-box; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; }
      th { background: #f3f4f6; }
      .report-shell { max-width: 900px; margin: 0 auto; }
      .report-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
      .report-branding { display: flex; align-items: center; gap: 12px; }
      .report-logo-wrap { width: 52px; height: 52px; border-radius: 12px; overflow: hidden; background: #fef2f2; display: grid; place-items: center; }
      .report-logo-wrap img { width: 100%; height: 100%; object-fit: cover; }
      .report-badge { background: #fef2f2; color: #991b1b; padding: 6px 10px; border-radius: 999px; font-weight: 700; }
      .report-summary-grid { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 12px; margin: 16px 0; }
      .report-summary-item { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; background: #fafafa; }
      .report-summary-item span { display: block; color: #6b7280; font-size: 12px; margin-bottom: 4px; }
      .report-meta { margin-top: 16px; }
      .report-footer { margin-top: 18px; font-size: 12px; color: #6b7280; text-align: center; }
      @media print { body { padding: 0; } }
    </style>`;
  win.document.open();
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>${styles}</head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => {
    try { win.print(); } catch (e) {}
  }, 250);
  return true;
}

function fallbackPrintPdf(label, html = '') {
  const report = $('report');
  if (report && html) report.innerHTML = html;
  toast(`${label} PDF export is unavailable right now. Your browser print window can still save it as PDF.`);
  if (html) {
    openPrintWindow(`${label} Report`, html);
    return;
  }
  window.print();
}

function safePdfFilename(name) {
  const normalized = String(name || 'Student').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const safe = normalized.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return safe || 'Student';
}

function addPdfHeading(doc, subtitle) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(153, 27, 27);
  doc.rect(0, 0, width, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('EXAM MARKS CALCULATOR', 14, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`RESULT REPORT  |  ${subtitle}`, 14, 22);
}

function addPdfFooter(doc) {
  const count = doc.internal.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  for (let page = 1; page <= count; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(229, 231, 235);
    doc.line(14, 283, width - 14, 283);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('Generated by Exam Marks Calculator', 14, 289);
    doc.text(`Page ${page} of ${count}`, width - 14, 289, { align: 'right' });
  }
}

function addPdfStudentDetails(doc, details, startY = 37) {
  doc.autoTable({
    startY,
    theme: 'grid',
    head: [['STUDENT INFORMATION', '']],
    body: details,
    margin: { left: 14, right: 14, top: 36, bottom: 16 },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5, overflow: 'linebreak', minCellWidth: 10, textColor: [31, 41, 55] },
    headStyles: { fillColor: [254, 226, 226], textColor: [127, 29, 29], fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold' } },
    didDrawPage: () => addPdfHeading(doc, doc.__reportSubtitle)
  });
  return doc.lastAutoTable.finalY;
}

function addPdfSummary(doc, items, startY) {
  let y = startY + 7;
  if (y > 255) {
    doc.addPage();
    y = 42;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(127, 29, 29);
  doc.text('RESULT SUMMARY', 14, y);
  doc.autoTable({
    startY: y + 3,
    theme: 'grid',
    body: items,
    margin: { left: 14, right: 14, top: 36, bottom: 16 },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5, overflow: 'linebreak', minCellWidth: 10 },
    columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } },
    didDrawPage: () => addPdfHeading(doc, doc.__reportSubtitle)
  });
}

function buildGpaReport(cgpa, semesterRows, courses, courseGpa) {
  const details = [
    ['Student Name', 'sName'],
    ['Registration / Roll Number', 'sRoll'],
    ['University / College', 'sUniversity'],
    ['Department', 'sDepartment'],
    ['Semester', 'sClass']
  ].map(([label, id]) => `<tr><th>${label}</th><td>${esc($(id).value) || '—'}</td></tr>`).join('');
  const semesterTable = semesterRows.map(([name, gpa]) => `<tr><td>${esc(name)}</td><td>${gpa}</td></tr>`).join('');
  const courseTable = courses.map(course =>
    `<tr><td>${esc(course.name)}</td><td>${fmt(course.cr)}</td><td>${course.grade}</td><td>${course.point.toFixed(2)}</td></tr>`
  ).join('');
  const courseSection = courses.length ? `
    <h2>COURSE GPA${courseGpa === null ? '' : `: ${courseGpa.toFixed(2)}`}</h2>
    <table><thead><tr><th>Course / Subject</th><th>Credit Hours</th><th>Grade</th><th>Grade Point</th></tr></thead><tbody>${courseTable}</tbody></table>` : '';
  return `
    <div class="report-shell">
      <div class="report-head"><div><div class="report-kicker">Academic Performance Report</div><h1>GPA / CGPA Report</h1></div></div>
      <table class="report-meta">${details}</table>
      ${courseSection}
      <h2>SEMESTER GPA RECORDS</h2>
      <table><thead><tr><th>Semester</th><th>GPA</th></tr></thead><tbody>${semesterTable}</tbody></table>
      <table class="report-meta"><tr><th>Overall CGPA</th><td>${cgpa.toFixed(2)}</td></tr></table>
      <p class="report-footer">Generated by Exam Marks Calculator</p>
    </div>`;
}

function validateRequiredPdfFields(fields) {
  const missing = fields.filter(([id]) => !$(id).value.trim());
  if (missing.length) {
    toast('Complete required information: ' + missing.map(([, label]) => label).join(', ') + '.');
    return false;
  }
  return true;
}

function downloadBoardPdf(type) {
  const fields = type === 'matric'
    ? [['sName', 'Student Name'], ['sFather', 'Father Name'], ['sRoll', 'Roll Number'], ['sSchool', 'School Name'], ['sYear', 'Examination Year']]
    : [['sName', 'Student Name'], ['sFather', 'Father Name'], ['sRoll', 'Roll Number'], ['sCollege', 'College Name'], ['sYear', 'Examination Year'], ['sFscPart', 'FSc Part']];
  if (!validateRequiredPdfFields(fields)) return;
  const result = calculateBoardResult(type);
  if (!result.summary || result.errors) {
    toast(result.errors ? 'Fix highlighted marks errors before downloading the PDF.' : 'Enter valid subject marks before downloading the PDF.');
    return;
  }
  try {
    const doc = pdfDocument();
    const title = type === 'matric' ? 'Matric Marks Sheet' : 'FSc Marks Sheet';
    doc.__reportSubtitle = title;
    const studentDetails = [
      ['Student Name', $('sName').value.trim()],
      ['Father Name', $('sFather').value.trim()],
      ['Roll Number', $('sRoll').value.trim()],
      [type === 'matric' ? 'School Name' : 'College Name', $(type === 'matric' ? 'sSchool' : 'sCollege').value.trim()],
      ['Examination Year', $('sYear').value.trim()]
    ];
    if (type === 'fsc') studentDetails.push(['Part', $('sFscPart').value]);
    let y = addPdfStudentDetails(doc, studentDetails);
    doc.autoTable({
      startY: y + 8,
      head: [['Subject', 'Obtained', 'Total', 'Percentage', 'Grade', 'Status']],
      body: result.summary.subjects.map(subject => [
        subject.name, fmt(subject.obtained), fmt(subject.total), fmt(subject.percentage) + '%',
        subject.grade, subject.pass ? 'Pass' : 'Fail'
      ]),
      theme: 'grid',
      margin: { left: 14, right: 14, top: 36, bottom: 18 },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak', valign: 'middle', minCellWidth: 10 },
      headStyles: { fillColor: [153, 27, 27], textColor: [255, 255, 255], fontStyle: 'bold' },
      didDrawPage: () => addPdfHeading(doc, title)
    });
    y = doc.lastAutoTable.finalY;
    addPdfSummary(doc, [
      ['Total Marks', fmt(result.summary.totalMax), 'Obtained Marks', fmt(result.summary.totalObtained)],
      ['Percentage', fmt(result.summary.percentage) + '%', 'Average', fmt(result.summary.average)],
      ['Overall Grade', result.summary.grade, 'Overall Result', result.summary.status]
    ], y);
    addPdfFooter(doc);
    const suffix = type === 'matric' ? 'Matric_Result' : 'FSc_Result';
    doc.save(`${safePdfFilename($('sName').value)}_${suffix}.pdf`);
    toast(`${type === 'matric' ? 'Matric' : 'FSc'} PDF downloaded.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF could not be created. Please try again.';
    if (message.includes('PDF library did not load')) {
      fallbackPrintPdf(type === 'matric' ? 'Matric' : 'FSc', buildBoardReport(type, result.summary));
      return;
    }
    toast(message);
  }
}

function downloadGpaPdf() {
  if (!validateRequiredPdfFields([
    ['sName', 'Student Name'], ['sRoll', 'Registration / Roll Number'],
    ['sUniversity', 'University / College'], ['sDepartment', 'Department'], ['sClass', 'Semester']
  ])) return;
  const enteredSubjects = subjects.filter(subject =>
    subject.name.trim() !== '' || subject.obt !== '' || (subject.tot !== '' && subject.tot !== '100') || subject.cr !== ''
  );
  let courses = [];
  let courseGpa = null;
  if (enteredSubjects.length) {
    const incompleteSubject = enteredSubjects.find(subject => !!validateSubject(subject));
    if (incompleteSubject) {
      calculateResults(true);
      toast('Complete or correct every course row before downloading the GPA report.');
      return;
    }
    const result = calculateResults(true);
    if (!last || result.errors) {
      toast('Enter valid course marks and fix highlighted errors before downloading the PDF.');
      return;
    }
    courses = last.list;
    courseGpa = last.gpa;
    if (enteredSubjects.some(subject => !(subject.cr !== '' && Number(subject.cr) > 0))) {
      toast('Enter positive credit hours for every course before downloading the PDF.');
      return;
    }
  }
  const populatedSems = sems.filter(sem => !semEmpty(sem));
  const invalidSems = populatedSems.filter(sem => !!validateSem(sem));
  if (!populatedSems.length || invalidSems.length) {
    toast('Enter at least one valid semester GPA for the CGPA report.');
    return;
  }
  calculateCGPA();
  const cgpa = Number($('cgpaVal').textContent);
  if (!Number.isFinite(cgpa)) {
    toast('A valid overall CGPA is required for this report.');
    return;
  }
  try {
    const doc = pdfDocument();
    doc.__reportSubtitle = 'GPA / CGPA Report';
    let y = addPdfStudentDetails(doc, [
      ['Student Name', $('sName').value.trim()],
      ['Registration / Roll Number', $('sRoll').value.trim()],
      ['University / College', $('sUniversity').value.trim()],
      ['Department', $('sDepartment').value.trim()],
      ['Semester', $('sClass').value.trim()]
    ]);
    if (courses.length) {
      doc.autoTable({
        startY: y + 8,
        head: [['Course / Subject', 'Credit Hours', 'Grade', 'Grade Point']],
        body: courses.map(course => [course.name, fmt(course.cr), course.grade, course.point.toFixed(2)]),
        theme: 'grid',
        margin: { left: 14, right: 14, top: 36, bottom: 18 },
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak', valign: 'middle', minCellWidth: 10 },
        headStyles: { fillColor: [153, 27, 27], textColor: [255, 255, 255], fontStyle: 'bold' },
        didDrawPage: () => addPdfHeading(doc, 'GPA / CGPA Report')
      });
      y = doc.lastAutoTable.finalY;
    }
    const semesterGpas = populatedSems.map((semester, index) => [
      semester.name.trim() || `Semester ${index + 1}`, Number(semester.gpa).toFixed(2)
    ]);
    if (y > 235) {
      doc.addPage();
      y = 42;
    } else y += 9;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(127, 29, 29);
    doc.text('SEMESTER GPA RECORDS', 14, y);
    doc.autoTable({
      startY: y + 3,
      head: [['Semester', 'GPA']],
      body: semesterGpas,
      theme: 'grid',
      margin: { left: 14, right: 14, top: 36, bottom: 18 },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [153, 27, 27], textColor: [255, 255, 255], fontStyle: 'bold' },
      didDrawPage: () => addPdfHeading(doc, 'GPA / CGPA Report')
    });
    const summaryItems = [
      ['Overall CGPA', cgpa.toFixed(2), 'Semester Count', String(populatedSems.length)]
    ];
    if (courseGpa !== null) {
      summaryItems.push([
        'Course GPA', courseGpa.toFixed(2), 'Course Count', String(courses.length)
      ]);
      summaryItems.push([
        'Total Course Credit Hours', fmt(courses.reduce((sum, course) => sum + course.cr, 0)), '', ''
      ]);
    }
    addPdfSummary(doc, summaryItems, doc.lastAutoTable ? doc.lastAutoTable.finalY : y);
    addPdfFooter(doc);
    doc.save(`${safePdfFilename($('sName').value)}_CGPA_Report.pdf`);
    toast('GPA/CGPA PDF downloaded.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PDF could not be created. Please try again.';
    if (message.includes('PDF library did not load')) {
      fallbackPrintPdf('GPA / CGPA', buildGpaReport(cgpa, semesterGpas, courses, courseGpa));
      return;
    }
    toast(message);
  }
}

function showBoardTab(type) {
  const panels = document.querySelectorAll('.board-panel');
  panels.forEach(panel => {
    const isActive = panel.id === type + 'Panel';
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });
  document.querySelectorAll('.board-tab').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.boardTab === type);
  });
}

function renderSubjectChart(r) {
  const panel = $('subjectChart');
  if (!panel) return;
  if (!r || !r.list || !r.list.length) {
    panel.innerHTML = `<div class="chart-empty">Add subject marks to view performance chart.</div>`;
    return;
  }
  const rows = r.list.map(s => {
    const tone = s.pct >= 80 ? 'high' : s.pct >= 60 ? 'mid' : s.pct >= 40 ? 'low' : 'warn';
    return `
      <div class="chart-row">
        <div class="chart-meta">
          <span>${esc(s.name)}</span>
          <strong>${fmt(s.pct)}%</strong>
        </div>
        <div class="chart-track"><div class="chart-fill ${tone}" style="width:${Math.min(s.pct, 100)}%"></div></div>
      </div>`;
  }).join('');
  panel.innerHTML = `
    <div class="chart-header">
      <h3>Subject Performance</h3>
      <span>${r.list.length} subjects</span>
    </div>
    <div class="chart-stack">${rows}</div>`;
}

/* ============ SUBJECTS ============ */
function addSubject() { subjects.push(newSubject()); renderRows(); calculateResults(); saveData(); const ins = document.querySelectorAll('#rows .row input[data-f="name"]'); ins[ins.length - 1]?.focus(); }
function removeSubject(i = subjects.length - 1) {
  if (subjects.length <= 1) return toast('At least one subject is required.');
  subjects.splice(i, 1); renderRows(); calculateResults(); saveData();
}

/* ============ STORAGE ============ */
function saveData() {
  try {
    const info = {}; INFO.forEach(id => info[id] = $(id).value);
    localStorage.setItem(STORE, JSON.stringify({ info, subjects, sems }));
  } catch (e) {}
}
function loadData() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (d && Array.isArray(d.subjects) && d.subjects.length) {
      subjects = d.subjects; INFO.forEach(id => $(id).value = (d.info && d.info[id]) || '');
      sems = Array.isArray(d.sems) && d.sems.length ? d.sems : [newSem(), newSem()];
      return true;
    }
  } catch (e) {}
  subjects = [newSubject(), newSubject(), newSubject()];
  sems = [newSem(), newSem()];
  return false;
}
function clearSavedData() {
  if (!window.confirm('Are you sure you want to clear all saved data?')) return;
  try { localStorage.removeItem(STORE); } catch (e) {}
  INFO.forEach(id => $(id).value = '');
  subjects = [newSubject(), newSubject(), newSubject()];
  sems = [newSem(), newSem()];
  last = null;
  renderRows(); renderSems(); renderResults(null); calculateCGPA();
  toast('Saved data cleared.');
}
function resetCalculator() {
  if (!window.confirm('Reset all fields and semester data?')) return;
  INFO.forEach(id => $(id).value = '');
  subjects = [newSubject(), newSubject(), newSubject()];
  sems = [newSem(), newSem()];
  renderRows(); renderSems(); calculateResults(); calculateCGPA(); saveData(); toast('Calculator reset.');
}

/* ============ THEME ============ */
function applyThemePreset(name) {
  const preset = THEME_PRESETS[name] ? name : 'rose';
  document.documentElement.dataset.accent = preset;
  try { localStorage.setItem(THEME_PRESET, preset); } catch (e) {}
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.preset === preset);
  });
}
function applyThemeUI() {
  const dark = document.documentElement.classList.contains('dark');
  $('themeIcon').className = 'fa-solid ' + (dark ? 'fa-sun' : 'fa-moon');
  $('themeText').textContent = dark ? 'Light' : 'Dark';
  const preset = localStorage.getItem(THEME_PRESET) || 'rose';
  applyThemePreset(preset);
}
function toggleTheme() {
  const dark = document.documentElement.classList.toggle('dark');
  try { localStorage.setItem(THEME, dark ? 'dark' : 'light'); } catch (e) {}
  applyThemeUI();
}

/* ============ REPORT / PRINT / DOWNLOAD ============ */
function buildReport() {
  const r = last, v = id => esc($(id).value) || '—';
  const rows = r.list.map(s => `<tr><td>${esc(s.name)}</td><td>${fmt(s.obt)}</td><td>${fmt(s.tot)}</td><td>${fmt(s.pct)}%</td><td>${s.grade}</td><td>${s.pass ? 'Pass' : 'Fail'}</td></tr>`).join('');
  return `
    <div class="report-shell">
      <div class="report-head">
        <div class="report-branding">
          <div class="report-logo-wrap"><img src="logo.png" alt="Exam Marks Calculator logo"></div>
          <div>
            <div class="report-kicker">Academic Performance Report</div>
            <h1>Exam Result Sheet</h1>
          </div>
        </div>
        <div class="report-badge">${r.status}</div>
      </div>
      <div class="report-summary-grid">
        <div class="report-summary-item"><span>Student</span><strong>${v('sName')}</strong></div>
        <div class="report-summary-item"><span>Roll No.</span><strong>${v('sRoll')}</strong></div>
        <div class="report-summary-item"><span>Class</span><strong>${v('sClass')}</strong></div>
        <div class="report-summary-item"><span>Exam</span><strong>${v('sExam')}</strong></div>
      </div>
      <table class="report-meta">
        <tr><th>Student Name</th><td>${v('sName')}</td><th>Roll Number</th><td>${v('sRoll')}</td></tr>
        <tr><th>Class / Semester</th><td>${v('sClass')}</td><th>Examination</th><td>${v('sExam')}</td></tr>
        <tr><th>Date</th><td colspan="3">${v('sDate')}</td></tr>
      </table>
      <table class="report-table">
        <thead><tr><th>Subject</th><th>Obtained</th><th>Total</th><th>Percentage</th><th>Grade</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <table class="report-meta">
        <tr><th>Total Marks</th><td>${fmt(r.totalMax)}</td><th>Obtained Marks</th><td>${fmt(r.totalObt)}</td></tr>
        <tr><th>Percentage</th><td>${fmt(r.pct)}%</td><th>Average</th><td>${fmt(r.avg)}</td></tr>
        <tr><th>GPA</th><td>${r.gpa.toFixed(2)}</td><th>Overall Grade</th><td>${r.grade}</td></tr>
        <tr><th>Performance</th><td>${r.perf}</td><th>Result</th><td>${r.status}</td></tr>
      </table>
      <p class="report-footer">Generated by Tariq Jameel • Exam Marks Calculator</p>
    </div>`;
}
// Runs a full validated calculation; returns true only if the result is safe to output
function ensureValidResult() {
  const res = calculateResults(true);
  if (!last || res.errors) { toast('Please fix the highlighted errors first.'); return false; }
  return true;
}
function printResult() {
  if (!ensureValidResult()) return;
  $('report').innerHTML = buildReport();
  window.print();
}
function exportPdfResult() {
  if (!ensureValidResult()) return;
  $('report').innerHTML = buildReport();
  toast('Print dialog opened. Choose “Save as PDF”.');
  window.print();
}
function downloadResult() {
  if (!ensureValidResult()) return;
  try {
    const doc = pdfDocument();
    doc.__reportSubtitle = 'Exam Result';
    const studentDetails = [
      ['Student Name', $('sName').value.trim() || '—'],
      ['Roll Number', $('sRoll').value.trim() || '—'],
      ['Class / Semester', $('sClass').value.trim() || '—'],
      ['Examination', $('sExam').value.trim() || '—'],
      ['Date', $('sDate').value.trim() || '—']
    ];
    const y = addPdfStudentDetails(doc, studentDetails);
    doc.autoTable({
      startY: y + 8,
      head: [['Subject', 'Obtained', 'Total', 'Percentage', 'Grade', 'Status']],
      body: last.list.map(subject => [
        subject.name, fmt(subject.obt), fmt(subject.tot), fmt(subject.pct) + '%',
        subject.grade, subject.pass ? 'Pass' : 'Fail'
      ]),
      theme: 'grid',
      margin: { left: 14, right: 14, top: 36, bottom: 18 },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak', valign: 'middle', minCellWidth: 10 },
      headStyles: { fillColor: [153, 27, 27], textColor: [255, 255, 255], fontStyle: 'bold' },
      didDrawPage: () => addPdfHeading(doc, 'Exam Result')
    });
    addPdfSummary(doc, [
      ['Total Marks', fmt(last.totalMax), 'Obtained Marks', fmt(last.totalObt)],
      ['Percentage', fmt(last.pct) + '%', 'Average', fmt(last.avg)],
      ['GPA', last.gpa.toFixed(2), 'Overall Grade', last.grade],
      ['Passed Subjects', String(last.passed), 'Failed Subjects', String(last.failed)],
      ['Result', last.status, '', '']
    ], doc.lastAutoTable.finalY);
    addPdfFooter(doc);
    doc.save(`${safePdfFilename($('sName').value)}_Exam_Result.pdf`);
    toast('Result PDF downloaded.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Result PDF could not be created. Please try again.';
    if (message.includes('PDF library did not load')) {
      fallbackPrintPdf('Exam Result', buildReport());
      return;
    }
    toast(message);
  }
}

/* ============ CGPA (cumulative GPA across semesters) ============ */
const MAX_GPA = Math.max(...GRADE_SCALE.map(g => g.point));
function newSem() { return { name: '', gpa: '', cr: '' }; }
const semEmpty = s => s.gpa === '' && s.name.trim() === '' && s.cr === '';

function validateSem(s) {
  if (s.gpa === '' || isNaN(+s.gpa)) return 'Enter the semester GPA.';
  if (+s.gpa < 0 || +s.gpa > MAX_GPA) return 'GPA must be between 0 and ' + MAX_GPA.toFixed(2) + '.';
  if (s.cr !== '' && (isNaN(+s.cr) || +s.cr < 0)) return 'Credit hours cannot be negative.';
  return '';
}

// CGPA = Σ(semester GPA × credit hours) / Σ(credit hours); blank credits count as 1
function calculateCGPA() {
  let pts = 0, cr = 0, sum = 0, n = 0, errs = 0;
  const validSems = [];
  const rows = document.querySelectorAll('#semRows .srow');
  sems.forEach((s, i) => {
    const row = rows[i];
    const p = row && row.querySelector('.err');
    const e = semEmpty(s) ? '' : validateSem(s);
    if (row) {
      row.classList.toggle('invalid', !!e);
      row.querySelectorAll('input').forEach(inp => inp.classList.toggle('invalid', !!e));
    }
    if (p) { p.textContent = e; p.classList.toggle('hidden', !e); }
    if (e) { errs++; return; }
    if (semEmpty(s)) return;
    const c = s.cr === '' ? 1 : +s.cr;
    pts += +s.gpa * c; cr += c; sum += +s.gpa; n++;
    validSems.push({ name: s.name.trim() || 'Semester ' + (i + 1), gpa: (+s.gpa).toFixed(2) });
  });
  const cgpa = n ? (cr > 0 ? pts / cr : sum / n) : null;
  $('cgpaVal').textContent = cgpa === null ? '—' : cgpa.toFixed(2);
  $('cgpaBar').style.width = cgpa === null ? '0' : Math.min(cgpa / MAX_GPA * 100, 100) + '%';
  $('cgpaMeta').textContent = cgpa === null ? 'Enter semester GPAs to calculate CGPA.'
    : `${n} semester(s), ${fmt(cr)} total credit hours (out of ${MAX_GPA.toFixed(2)})`;
  $('cgpaBreakdown').innerHTML = validSems.map(s => `<span class="rounded-full border border-neutral-200 px-3 py-1 text-xs dark:border-neutral-700">${esc(s.name)}: <strong>${s.gpa}</strong></span>`).join('');
  $('cgpaErr').textContent = errs ? errs + ' semester(s) have issues and are left out of the CGPA.' : '';
  $('cgpaErr').classList.toggle('hidden', !errs);
}

function renderSems() {
  $('semRows').innerHTML = sems.map((s, i) => `
    <div class="srow sub fade" data-i="${i}">
      <div class="grid grid-cols-2 items-end gap-3 md:grid-cols-12">
        <div class="col-span-2 md:col-span-5"><label class="lbl">Semester</label><input data-f="name" class="inp" placeholder="Semester ${i + 1}" value="${esc(s.name)}"></div>
        <div class="md:col-span-3"><label class="lbl">GPA</label><input data-f="gpa" type="number" min="0" max="${MAX_GPA}" step="any" inputmode="decimal" class="inp" placeholder="e.g. 3.50" value="${esc(s.gpa)}"></div>
        <div class="md:col-span-3"><label class="lbl">Credit Hours</label><input data-f="cr" type="number" min="0" step="any" inputmode="decimal" class="inp" placeholder="optional" value="${esc(s.cr)}"></div>
        <div class="col-span-2 flex justify-end md:col-span-1"><button data-del class="rounded-lg p-2 text-neutral-500 transition hover:text-red-600" aria-label="Remove semester"><i class="fa-solid fa-xmark"></i></button></div>
      </div>
      <p class="err mt-2 hidden text-xs font-medium text-red-600 dark:text-red-400"></p>
    </div>`).join('');
}
function addSemester() { sems.push(newSem()); renderSems(); calculateCGPA(); saveData(); }
function removeSemester(i = sems.length - 1) {
  if (sems.length <= 1) return toast('At least one semester is required.');
  sems.splice(i, 1); renderSems(); calculateCGPA(); saveData();
}
// Copies the GPA of the result above into the CGPA list
function useCurrentGPA() {
  if (!ensureValidResult()) return;
  const cr = last.list.reduce((a, s) => a + s.cr, 0);
  const row = { name: $('sClass').value.trim() || 'Semester ' + (sems.filter(s => !semEmpty(s)).length + 1), gpa: last.gpa.toFixed(2), cr: String(cr) };
  const idx = sems.findIndex(semEmpty);
  if (idx >= 0) sems[idx] = row; else sems.push(row);
  renderSems(); calculateCGPA(); saveData(); toast('Current GPA added to CGPA.');
}

/* ============ EVENTS ============ */
$('rows').addEventListener('input', e => {
  const f = e.target.dataset.f; if (!f) return;
  subjects[+e.target.closest('.row').dataset.i][f] = e.target.value;
  calculateResults(); saveData();
});
$('rows').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) removeSubject(+b.closest('.row').dataset.i); });
INFO.forEach(id => $(id).addEventListener('input', saveData));
$('addBtn').onclick = () => addSubject();
$('removeBtn').onclick = () => removeSubject();
$('calcBtn').onclick = () => { const r = calculateResults(true); toast(last && !r.errors ? 'Result calculated!' : last ? 'Calculated valid subjects; fix the errors shown.' : 'Enter valid marks to calculate.'); };
$('resetBtn').onclick = $('resetTop').onclick = resetCalculator;
$('printBtn').onclick = printResult;
$('pdfBtn').onclick = exportPdfResult;
$('dlBtn').onclick = downloadResult;
$('saveBtn').onclick = () => { saveData(); toast('Result saved in this browser.'); };
$('clearBtn').onclick = clearSavedData;
$('themeBtn').onclick = toggleTheme;
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => applyThemePreset(btn.dataset.preset));
});
$('semRows').addEventListener('input', e => {
  const f = e.target.dataset.f; if (!f) return;
  sems[+e.target.closest('.srow').dataset.i][f] = e.target.value;
  calculateCGPA(); saveData();
});
$('semRows').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) removeSemester(+b.closest('.srow').dataset.i); });
$('addSemBtn').onclick = addSemester;
$('removeSemBtn').onclick = () => removeSemester();
$('useGpaBtn').onclick = useCurrentGPA;

document.querySelectorAll('.board-tab').forEach(btn => {
  btn.addEventListener('click', () => showBoardTab(btn.dataset.boardTab));
});

['matric', 'fsc'].forEach(type => {
  const rows = document.getElementById(type + 'Rows');
  if (!rows) return;
  rows.addEventListener('input', event => {
    const field = event.target.dataset.boardField;
    const index = Number(event.target.dataset.index);
    if (!field || Number.isNaN(index)) return;
    const subject = boardData[type].subjects[index];
    if (!subject) return;
    subject[field] = event.target.value;
    calculateBoardResult(type);
    saveData();
  });
  rows.addEventListener('click', event => {
    const btn = event.target.closest('[data-board-remove]');
    if (!btn) return;
    removeBoardSubject(btn.dataset.boardRemove, Number(btn.dataset.index));
  });
  document.getElementById('add' + type.charAt(0).toUpperCase() + type.slice(1) + 'Btn').onclick = () => addBoardSubject(type);
  const removeBtn = document.getElementById('remove' + type.charAt(0).toUpperCase() + type.slice(1) + 'Btn');
  if (removeBtn) removeBtn.onclick = () => removeBoardSubject(type);
  document.getElementById('calc' + type.charAt(0).toUpperCase() + type.slice(1) + 'Btn').onclick = () => {
    const result = calculateBoardResult(type);
    if (result.ok) toast(type.toUpperCase() + ' result calculated.');
    else toast('Fix highlighted subject errors first.');
  };
  document.getElementById('print' + type.charAt(0).toUpperCase() + type.slice(1) + 'Btn').onclick = () => printBoardResult(type);
  document.getElementById('download' + type.charAt(0).toUpperCase() + type.slice(1) + 'PdfBtn').onclick = () => downloadBoardPdf(type);
});
$('downloadGpaPdfBtn').onclick = downloadGpaPdf;

/* ============ INIT ============ */
const restored = loadData();
try {
  const savedDark = localStorage.getItem(THEME) === 'dark';
  if (savedDark) document.documentElement.classList.add('dark');
} catch (e) {}
applyThemeUI(); renderRows(); renderSems(); renderBoardRows('matric'); renderBoardRows('fsc'); calculateResults(); calculateCGPA(); calculateBoardResult('matric'); calculateBoardResult('fsc');
if (restored) toast('Saved result restored from your browser.');
