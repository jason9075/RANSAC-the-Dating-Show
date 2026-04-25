'use strict';

// ── Dimension definitions ──────────────────────────────────────────────────────
const DIMS = [
  { key: 'cilantro',  label: 'Cilantro Tolerance',       labelZh: '香菜耐受度',       short: 'Cilantro',  min: 0,  max: 100, unit: '',
    tip:   'Score 0 = "get that soap away from me." Score 100 = orders extra cilantro on everything. The ultimate culinary dealbreaker — no algorithm can bridge this gap.',
    tipZh: '0 分 = 「那是肥皂吧」，100 分 = 叫外送必加「香菜加倍」。飲食觀的根本分歧，任何演算法都難以彌合。' },
  { key: 'invoice',   label: 'Cloud Invoice Rate',        labelZh: '發票載具使用率',   short: 'Invoice',   min: 0,  max: 100, unit: '%',
    tip:   'How often do you use the e-invoice carrier instead of taking a paper receipt? A proxy for civic responsibility, tax-law awareness, and whether your phone was made after 2018.',
    tipZh: '你有多常用手機載具而不是索取紙本？反映公民意識、對稅法的了解，以及你的手機是否在 2018 年之後製造。' },
  { key: 'threads',   label: 'Threads Shitposting Idx',  labelZh: 'Threads 廢文產出指數', short: 'Threads',   min: 0,  max: 20,  unit: '/day',
    tip:   'Daily volume of low-effort content fired into the void. 0 = lurker with opinions. 20 = chronically online. Your soul match posts at exactly the same frequency — no more, no less.',
    tipZh: '每天發多少低努力含量的內容進虛空？0 = 有想法但只看不發，20 = 嚴重網路成癮。真愛的條件：對方發廢文的頻率跟你完全一致。' },
  { key: 'actemp',    label: 'AC Temp Preference',        labelZh: '空調偏好溫度',     short: 'AC Temp',   min: 16, max: 30,  unit: '°C',
    tip:   'The thermostat is the #1 source of relationship conflict. 16°C = penguin mode. 30°C = "why is the AC even on?" A 2°C gap is negotiable; 8°C is a dealbreaker.',
    tipZh: '冷氣溫度是所有長期關係衝突的第一來源。16°C = 企鵝模式，30°C = 「冷氣開著幹嘛」。2°C 的差距還可以協商；超過 8°C 請直接分手。' },
  { key: 'mysticism', label: 'Mysticism Belief',          labelZh: '神祕學迷信程度',   short: 'Mysticism', min: 0,  max: 100, unit: '',
    tip:   'How much do you believe Mercury retrograde ruined your pull request? 0 = "correlation ≠ causation." 100 = won\'t make decisions on a void-of-course moon. Extreme mismatch causes irreconcilable epistemological differences.',
    tipZh: '你有多相信水星逆行毀了你的 pull request？0 = 「相關性不等於因果」，100 = 月亮空亡不做決定。極端不匹配會導致無法調和的認識論分歧。' },
  { key: 'mute',      label: 'Mute Speed',                labelZh: '群組靜音反射時間', short: 'Mute',      min: 0,  max: 60,  unit: 's',
    tip:   'Seconds until you mute the family group chat after a new message appears. 0 = reflexive mute (you are spiritually exhausted). 60 = masochist who reads every forward. A shared mute strategy is the bedrock of domestic peace.',
    tipZh: '家族群組傳來新訊息後，你幾秒內靜音？0 = 反射動作（你已精神疲憊），60 = 還在看完所有轉發訊息的受虐狂。共同的靜音策略是家庭和平的基石。' },
  { key: 'ghosting',  label: 'Ghosting Resilience',       labelZh: '被放鳥復原係數',   short: 'Ghosting',  min: 1,  max: 10,  unit: '',
    tip:   'Recovery speed after being left on read. 1 = still refreshing their profile two years later. 10 = "who? anyway, here\'s my new side project." High resilience is admirable; a perfect 10 may indicate emotional unavailability.',
    tipZh: '被已讀不回之後的心理復原速度。1 = 兩年後還在反覆看對方的限時動態，10 = 「誰？算了，來看我的新 side project」。高分令人欽佩；滿分可能代表迴避型依附。' },
  { key: 'dotfiles',  label: 'Work Originality',           labelZh: '作品原創純度',     short: 'Originality', min: 0,  max: 100, unit: '',
    tip:   'What % of things you call "your own work" did you actually produce? 0 = pasted ChatGPT output, changed the font, submitted as original. 100 = can explain every line without looking at the source. Your soul match operates at exactly the same level of plausible deniability.',
    tipZh: '你說的「我做的」有幾成真的是你做的？0 = 整份報告讓 AI 生成，改完字型就上台報告；100 = 每句話都能用自己的話再說一遍。真愛就是找到跟你誠實程度剛好一樣的人。' },
];

const N_TOTAL  = 100;
const RANSAC_K = 9; // 8 weights + 1 bias = 9 unknowns

const DEFAULTS = { nInliers: 50, maxIter: 100, threshold: 5 };

const COLOR_DEFAULT   = '#B2AC88';
const COLOR_INLIER    = '#FF8B94';
const COLOR_OUTLIER   = '#A9A9A9';
const COLOR_CONSENSUS = '#c9a0dc';
const COLOR_TRUTH     = '#9b7bb5';

// ── App state ──────────────────────────────────────────────────────────────────
const S = {
  candidates: [],
  wTrue: [],
  bTrue: 0,
  axisX: 0,
  axisY: 1,
  showInliers:  false,
  showOutliers: false,
  showTruth:    false,
  running: false,
  done:    false,
  bestWeights: null,
  bestBias:    0,
  bestConsensus: 0,
  bestSet: new Set(),
  currentIter: 0,
  nInliers:  DEFAULTS.nInliers,
  maxIter:   DEFAULTS.maxIter,
  threshold: 0.05,
  positions: [],  // current canvas coords [{cx,cy}]
  targets:   [],  // target  canvas coords [{cx,cy}]
  hoveredIdx: null,
  heartbeat:  0,
  lang: 'en',
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const canvas   = document.getElementById('scatter-canvas');
const ctx      = canvas.getContext('2d');
const selX     = document.getElementById('axis-x');
const selY     = document.getElementById('axis-y');
const btnInliers  = document.getElementById('toggle-inliers');
const btnOutliers = document.getElementById('toggle-outliers');
const btnTruth    = document.getElementById('toggle-truth');
const btnRun      = document.getElementById('run-btn');
const ctrlIter    = document.getElementById('ctrl-iter');
const valIter     = document.getElementById('val-iter');
const ctrlThresh  = document.getElementById('ctrl-thresh');
const valThresh   = document.getElementById('val-thresh');
const ctrlSouls   = document.getElementById('ctrl-souls');
const valSouls    = document.getElementById('val-souls');
const resetBtn    = document.getElementById('reset-btn');
const statIter    = document.getElementById('stat-iter');
const statCons    = document.getElementById('stat-consensus');
const statMax     = document.getElementById('stat-max');
const statResid   = document.getElementById('stat-residual');
const progressBar = document.getElementById('progress-bar');
const glowEl      = document.getElementById('glow-overlay');
const singWarn    = document.getElementById('singular-warn');
const formulaPanel= document.getElementById('formula-panel');
const formulaText = document.getElementById('formula-text');
const resultBanner= document.getElementById('result-banner');
const resultSub   = document.getElementById('result-sub');
const axisXLabel  = document.getElementById('axis-x-label');
const axisYLabel  = document.getElementById('axis-y-label');
const tooltip     = document.getElementById('tooltip');
const mathModal   = document.getElementById('math-modal');
const modalBody   = document.getElementById('modal-body');
const mathBtn        = document.getElementById('math-btn');
const closeModal     = document.getElementById('close-modal');
const globalLangBtn  = document.getElementById('global-lang-btn');

// ── i18n ──────────────────────────────────────────────────────────────────────
const I18N = {
  en: {
    subtitle:       n => `Finding true love in 8 dimensions | 100 candidates·${n} soul matches hidden within`,
    panelAxes:      'Projection Axes',
    panelGod:       'God Mode',
    panelConfig:    'RANSAC Config',
    panelMonitor:   'Algorithm Monitor',
    panelLegend:    'Legend',
    panelFormula:   'True Love Formula',
    btnInliers:     'Show Inliers',
    btnOutliers:    'Show Outliers',
    btnTruth:       'Ground Truth Line',
    lblIter:        'Iterations',
    lblThresh:      'Threshold',
    lblSouls:       'Soul Matchers',
    btnReset:       '↺',
    btnRun:         '▶ Run RANSAC',
    btnRunAgain:    '▶ Run Again',
    btnRunning:     '⏳ Running...',
    statIter:       'RANSAC Iteration',
    statCons:       'Consensus Set Size',
    statMax:        'Max Consensus Found',
    statResid:      'Model Residual',
    legendDefault:  'Default candidate',
    legendInlier:   'Inlier (soul match)',
    legendOutlier:  'Outlier (acting)',
    legendConsensus:'RANSAC consensus',
    resultTitle:    '💘 True Love Found!',
    resultSub:      (n, t) => `${n} soul matches found in ${t} iterations`,
    formulaBias:       '(bias)',
    formulaGTLabel:    '🔮 Ground Truth',
    formulaRANSACLabel:'🎯 RANSAC Estimate',
    errSection:      'Residual (all candidates)',
    errInlierSection:'Residual (true inliers)',
    errMin:          'Min',
    errMax:          'Max',
    errAvg:          'Avg',
    modalTitle:     'Math Behind the Scene',
    modalClose:     'Close ✕',
    langBtn:        '中文',
  },
  zh: {
    subtitle:       n => `在 8 個維度中尋找真愛｜100 位候選人 · ${n} 位真愛戰士藏在其中`,
    panelAxes:      '投影軸',
    panelGod:       '上帝視角',
    panelConfig:    'RANSAC 設定',
    panelMonitor:   '演算法監控',
    panelLegend:    '圖例',
    panelFormula:   '真愛公式',
    btnInliers:     '顯示 Inliers',
    btnOutliers:    '顯示 Outliers',
    btnTruth:       '真理平面',
    lblIter:        '迭代次數',
    lblThresh:      '閾值',
    lblSouls:       '真愛戰士數量',
    btnReset:       '↺',
    btnRun:         '▶ 執行 RANSAC',
    btnRunAgain:    '▶ 再跑一次',
    btnRunning:     '⏳ 執行中...',
    statIter:       'RANSAC 迭代',
    statCons:       'Consensus Set 大小',
    statMax:        '最大共識集',
    statResid:      '模型殘差',
    legendDefault:  '預設候選人',
    legendInlier:   'Inlier（真愛戰士）',
    legendOutlier:  'Outlier（演技派）',
    legendConsensus:'RANSAC 共識集',
    resultTitle:    '💘 真愛現身！',
    resultSub:      (n, t) => `在 ${t} 次迭代中找到 ${n} 位真愛戰士`,
    formulaBias:       '（截距）',
    formulaGTLabel:    '🔮 真理權重',
    formulaRANSACLabel:'🎯 RANSAC 估計',
    errSection:      '殘差（所有候選人）',
    errInlierSection:'殘差（真愛戰士）',
    errMin:          '最小',
    errMax:          '最大',
    errAvg:          '平均',
    modalTitle:     '頁面背後的數學',
    modalClose:     '關閉 ✕',
    langBtn:        'English',
  },
};

function updateSubtitle() {
  const el = document.querySelector('[data-i18n="subtitle"]');
  if (el) el.textContent = I18N[S.lang].subtitle(S.nInliers);
}

function applyLang() {
  const t = I18N[S.lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    if (el === btnRun) return; // run button state managed separately
    const key = el.dataset.i18n;
    if (key === 'subtitle') return; // handled by updateSubtitle()
    if (typeof t[key] === 'string') el.textContent = t[key];
  });
  updateSubtitle();
  globalLangBtn.textContent = t.langBtn;
  mathBtn.title = S.lang === 'en' ? 'Explain the math' : '數學原理說明';
  // Update run button state text
  if (S.running) {
    btnRun.textContent = t.btnRunning;
  } else if (S.done) {
    btnRun.textContent = t.btnRunAgain;
  }
  // Sync modal content
  renderModal();
}

// ── Data generation ────────────────────────────────────────────────────────────
function rng(lo, hi) { return lo + Math.random() * (hi - lo); }

function generateData() {
  const wTrue = [0.30, -0.18, 0.22, 0.28, -0.12, 0.20, 0.35, -0.15];
  const bTrue = 0.50;
  S.wTrue = wTrue;
  S.bTrue = bTrue;

  const all = [];
  for (let i = 0; i < N_TOTAL; i++) {
    const raw  = DIMS.map(d => rng(d.min, d.max));
    const norm = DIMS.map((d, j) => (raw[j] - d.min) / (d.max - d.min));
    const isInlier = i < S.nInliers;
    let y;
    if (isInlier) {
      y = norm.reduce((s, x, j) => s + wTrue[j] * x, bTrue);
      y += (Math.random() - 0.5) * 0.06;
    } else {
      y = rng(0, 1);
    }
    all.push({ id: i, raw, norm, y, isInlier, residual: null });
  }

  // Shuffle so inliers aren't visually clustered at start
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  S.candidates = all;
}

// ── Canvas coordinate mapping ─────────────────────────────────────────────────
const PAD = { top: 28, right: 28, bottom: 36, left: 36 };

function toScreenX(normVal) {
  return PAD.left + normVal * (canvas.width - PAD.left - PAD.right);
}
function toScreenY(normVal) {
  return canvas.height - PAD.bottom - normVal * (canvas.height - PAD.top - PAD.bottom);
}

function updateTargets() {
  const xi = S.axisX;
  const yi = S.axisY;
  S.targets = S.candidates.map(c => ({
    cx: toScreenX(c.norm[xi]),
    cy: toScreenY(c.norm[yi]),
  }));
}

// ── Gaussian elimination (Gauss-Jordan) ───────────────────────────────────────
function gaussElim(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) maxRow = r;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    if (Math.abs(M[col][col]) < 1e-10) return null;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

function fitModel(indices) {
  const A = indices.map(idx => [...S.candidates[idx].norm, 1]);
  const b = indices.map(idx => S.candidates[idx].y);
  const sol = gaussElim(A, b);
  if (!sol) return null;
  return { w: sol.slice(0, 8), bias: sol[8] };
}

function predict(model, norm) {
  return norm.reduce((s, x, j) => s + model.w[j] * x, model.bias);
}

// Ordinary least squares via normal equations: (XᵀX)θ = Xᵀy
function leastSquares(indices) {
  const D = 9; // 8 features + 1 bias
  const XTX = Array.from({length: D}, () => new Array(D).fill(0));
  const XTy = new Array(D).fill(0);
  for (const idx of indices) {
    const c = S.candidates[idx];
    const row = [...c.norm, 1];
    for (let i = 0; i < D; i++) {
      XTy[i] += row[i] * c.y;
      for (let j = 0; j < D; j++) XTX[i][j] += row[i] * row[j];
    }
  }
  const sol = gaussElim(XTX, XTy);
  if (!sol) return null;
  return { w: sol.slice(0, 8), bias: sol[8] };
}

// ── 2D linear regression (for projected line drawing) ─────────────────────────
function linReg2D(pts) {
  const n = pts.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (const p of pts) { sx += p.x; sy += p.y; sxy += p.x * p.y; sxx += p.x * p.x; }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-10) return null;
  const m = (n * sxy - sx * sy) / denom;
  const c = (sy - m * sx) / n;
  return { m, c };
}

// ── RANSAC step (called via setTimeout) ───────────────────────────────────────
let ransacTimer = null;

function ransacStep() {
  if (S.currentIter >= S.maxIter) { finishRANSAC(); return; }
  S.currentIter++;

  progressBar.style.width = `${(S.currentIter / S.maxIter) * 100}%`;
  statIter.textContent = `${S.currentIter} / ${S.maxIter}`;

  // Fisher-Yates sample of RANSAC_K indices
  const pool = Array.from({ length: N_TOTAL }, (_, i) => i);
  for (let i = 0; i < RANSAC_K; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const sample = pool.slice(0, RANSAC_K);

  const model = fitModel(sample);
  if (!model) {
    singWarn.style.opacity = '1';
    setTimeout(() => { singWarn.style.opacity = '0'; }, 800);
    ransacTimer = setTimeout(ransacStep, 80);
    return;
  }

  const thresh = S.threshold;
  const consensusSet = new Set();
  let totalResid = 0;

  for (let i = 0; i < N_TOTAL; i++) {
    const c = S.candidates[i];
    const r = Math.abs(c.y - predict(model, c.norm));
    c.residual = r;
    if (r < thresh) { consensusSet.add(i); totalResid += r; }
  }

  const size = consensusSet.size;
  statCons.textContent   = size;
  statResid.textContent  = size > 0 ? (totalResid / size).toFixed(4) : '—';

  if (size > S.bestConsensus) {
    S.bestConsensus = size;
    S.bestSet       = consensusSet;
    S.bestWeights   = model.w.slice();
    S.bestBias      = model.bias;
    statMax.textContent = size;
    triggerGlow();
  }

  ransacTimer = setTimeout(ransacStep, 80);
}

function resetRANSACState() {
  if (ransacTimer) { clearTimeout(ransacTimer); ransacTimer = null; }
  S.running = false; S.done = false;
  S.currentIter = 0; S.bestConsensus = 0;
  S.bestSet = new Set(); S.bestWeights = null;
  resultBanner.classList.remove('visible');
  progressBar.style.width = '0%';
  statIter.textContent = '—'; statCons.textContent = '—';
  statMax.textContent  = '—'; statResid.textContent = '—';
  btnRun.disabled = false;
  btnRun.textContent = I18N[S.lang].btnRun;
  renderFormula(); // show GT weights; RANSAC column resets to "—"
}

function triggerGlow() {
  glowEl.style.opacity = '1';
  setTimeout(() => { glowEl.style.opacity = '0'; }, 280);
}

function finishRANSAC() {
  S.running = false;
  S.done    = true;
  btnRun.disabled = false;
  btnRun.textContent = I18N[S.lang].btnRunAgain;

  // Refit with least squares on the full best consensus set
  if (S.bestSet.size >= RANSAC_K) {
    const refined = leastSquares([...S.bestSet]);
    if (refined) { S.bestWeights = refined.w; S.bestBias = refined.bias; }
  }

  if (S.bestWeights) renderFormula();

  resultSub.textContent = I18N[S.lang].resultSub(S.bestConsensus, S.maxIter);
  resultBanner.classList.add('visible');
  setTimeout(() => resultBanner.classList.remove('visible'), 3500);
}

function renderFormula() {
  const t = I18N[S.lang];
  const fmt  = w => (w >= 0 ? '+' : '') + w.toFixed(3);
  const fmtE = v => v.toFixed(4);
  const dash = `<span style="color:var(--text-sub)">—</span>`;
  const biasLabel = S.lang === 'zh' ? '截距' : 'bias';

  // Weight rows
  const rowsHtml = DIMS.map((d, i) => {
    const estCell = S.bestWeights
      ? `<span class="ft-est">${fmt(S.bestWeights[i])}</span>` : dash;
    return `<tr data-dim="${i}">`
      + `<td>${d.short}</td>`
      + `<td><span class="ft-gt">${fmt(S.wTrue[i])}</span></td>`
      + `<td>${estCell}</td></tr>`;
  }).join('');

  const biasEstCell = S.bestWeights
    ? `<span class="ft-est">${fmt(S.bestBias)}</span>` : dash;

  // Residual stats helper
  const computeStats = (weights, bias) => {
    const res = S.candidates.map(c =>
      Math.abs(c.y - c.norm.reduce((s, x, j) => s + weights[j] * x, bias))
    );
    return {
      min: Math.min(...res),
      max: Math.max(...res),
      avg: res.reduce((a, r) => a + r, 0) / res.length,
    };
  };
  const gtSt  = computeStats(S.wTrue, S.bTrue);
  const estSt = S.bestWeights ? computeStats(S.bestWeights, S.bestBias) : null;

  // Inlier-only stats (filtered by ground truth isInlier flag)
  const computeInlierStats = (weights, bias) => {
    const res = S.candidates
      .filter(c => c.isInlier)
      .map(c => Math.abs(c.y - c.norm.reduce((s, x, j) => s + weights[j] * x, bias)));
    if (res.length === 0) return null;
    return {
      min: Math.min(...res),
      max: Math.max(...res),
      avg: res.reduce((a, r) => a + r, 0) / res.length,
    };
  };
  const gtInSt  = computeInlierStats(S.wTrue, S.bTrue);
  const estInSt = S.bestWeights ? computeInlierStats(S.bestWeights, S.bestBias) : null;

  const makeErrRows = (gtS, estS) => [
    [t.errMin, gtS?.min, estS?.min],
    [t.errMax, gtS?.max, estS?.max],
    [t.errAvg, gtS?.avg, estS?.avg],
  ].map(([label, gtV, estV]) =>
    `<tr><td>${label}</td>`
    + `<td><span class="ft-gt">${gtV != null ? fmtE(gtV) : '—'}</span></td>`
    + `<td>${estV != null ? `<span class="ft-est">${fmtE(estV)}</span>` : dash}</td></tr>`
  ).join('');

  const errTable = (title, gtS, estS) =>
    `<div style="font-size:0.54rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-sub);margin-bottom:0.18rem">${title}</div>`
    + `<table class="formula-table"><thead><tr>`
    + `<th></th><th style="color:#9b7bb5">🔮 GT</th><th style="color:#FF8B94">🎯 Est</th>`
    + `</tr></thead><tbody>${makeErrRows(gtS, estS)}</tbody></table>`;

  formulaText.innerHTML =
    // Formula expression
    `<div style="text-align:center;font-size:0.57rem;color:var(--text-sub);margin-bottom:0.35rem;letter-spacing:0.02em">Y = Σ wᵢxᵢ + b</div>`
    // Weight table
    + `<table class="formula-table"><thead><tr>`
    + `<th></th><th style="color:#9b7bb5">🔮 GT</th><th style="color:#FF8B94">🎯 Est</th>`
    + `</tr></thead><tbody>`
    + rowsHtml
    + `<tr class="ft-bias"><td>${biasLabel}</td>`
    + `<td><span class="ft-gt">${fmt(S.bTrue)}</span></td>`
    + `<td>${biasEstCell}</td></tr>`
    + `</tbody></table>`
    // All-candidate residuals
    + `<div style="height:1px;background:var(--panel-border);margin:0.42rem 0 0.32rem"></div>`
    + errTable(t.errSection, gtSt, estSt)
    // Inlier-only residuals
    + `<div style="height:1px;background:var(--panel-border);margin:0.42rem 0 0.32rem"></div>`
    + errTable(t.errInlierSection, gtInSt, estInSt);

  formulaPanel.classList.add('visible');
  bindFormulaHover();
}

// ── Render loop ───────────────────────────────────────────────────────────────
let lastTs = 0;
const LERP = 6; // lerp speed per second

function lerp(a, b, t) { return a + (b - a) * t; }

function render(ts) {
  requestAnimationFrame(render);
  const dt = Math.min((ts - lastTs) / 1000, 0.1);
  lastTs = ts;

  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Lerp positions toward targets
  const lf = Math.min(1, LERP * dt);
  for (let i = 0; i < S.positions.length; i++) {
    S.positions[i].cx = lerp(S.positions[i].cx, S.targets[i].cx, lf);
    S.positions[i].cy = lerp(S.positions[i].cy, S.targets[i].cy, lf);
  }

  // Heartbeat pulse after RANSAC done
  const pulse = S.done ? 1 + 0.28 * Math.abs(Math.sin(ts * 0.003)) : 1;

  drawGrid(W, H);

  // Ground truth regression line (through true inliers)
  if (S.showTruth) {
    const inlierPts = S.candidates
      .map((c, i) => (c.isInlier ? { x: S.positions[i].cx, y: S.positions[i].cy, ci: i } : null))
      .filter(Boolean);

    const reg = linReg2D(inlierPts);
    if (reg) {
      const x0 = PAD.left, x1 = W - PAD.right;
      ctx.save();
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = COLOR_TRUTH;
      ctx.lineWidth   = 1.8;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(x0, reg.m * x0 + reg.c);
      ctx.lineTo(x1, reg.m * x1 + reg.c);
      ctx.stroke();

      // Residual drops from each inlier to truth line
      ctx.setLineDash([3, 4]);
      ctx.lineWidth   = 0.9;
      ctx.globalAlpha = 0.28;
      for (const p of inlierPts) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, reg.m * p.x + reg.c);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // RANSAC best model line (through consensus set)
  if (S.done && S.bestSet.size > 1) {
    const pts = [];
    S.bestSet.forEach(i => pts.push({ x: S.positions[i].cx, y: S.positions[i].cy }));
    const reg = linReg2D(pts);
    if (reg) {
      const x0 = PAD.left, x1 = W - PAD.right;
      ctx.save();
      ctx.strokeStyle = COLOR_INLIER;
      ctx.lineWidth   = 2;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(x0, reg.m * x0 + reg.c);
      ctx.lineTo(x1, reg.m * x1 + reg.c);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Draw dots
  for (let i = 0; i < S.candidates.length; i++) {
    const c   = S.candidates[i];
    const pos = S.positions[i];
    let color = COLOR_DEFAULT;
    let alpha = 1;
    let r     = 5;
    let glow  = 3;

    if (S.showOutliers && !c.isInlier) { color = COLOR_OUTLIER; alpha = 0.2; }
    if (S.showInliers  && c.isInlier)  { color = COLOR_INLIER; r = 6; glow = 8; }
    if (S.done && S.bestSet.has(i))    { color = COLOR_CONSENSUS; glow = 6; }

    // Heartbeat for inliers after RANSAC done
    if (S.done && S.showInliers && c.isInlier) r *= pulse;
    if (i === S.hoveredIdx) { r = Math.max(r, 7); glow = 14; }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur  = glow;
    ctx.fillStyle   = color;
    ctx.beginPath();
    ctx.arc(pos.cx, pos.cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawGrid(W, H) {
  ctx.save();
  ctx.strokeStyle = 'rgba(178,172,136,0.18)';
  ctx.lineWidth   = 1;
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const t  = i / steps;
    const px = PAD.left  + t * (W - PAD.left - PAD.right);
    const py = H - PAD.bottom - t * (H - PAD.top - PAD.bottom);
    ctx.beginPath(); ctx.moveTo(px, PAD.top);    ctx.lineTo(px, H - PAD.bottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD.left, py);   ctx.lineTo(W - PAD.right, py);  ctx.stroke();
  }
  ctx.restore();
}

// ── Canvas resize ─────────────────────────────────────────────────────────────
function resizeCanvas() {
  const wrap = document.getElementById('canvas-wrap');
  const r    = wrap.getBoundingClientRect();
  canvas.width  = r.width;
  canvas.height = r.height;
  updateTargets();
  // Snap on resize, no animation
  S.positions = S.targets.map(t => ({ ...t }));
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function hitTest(mx, my) {
  let best = null;
  let minD = 12;
  for (let i = 0; i < S.positions.length; i++) {
    const d = Math.hypot(mx - S.positions[i].cx, my - S.positions[i].cy);
    if (d < minD) { minD = d; best = i; }
  }
  return best;
}

function showTooltip(idx, clientX, clientY) {
  const c = S.candidates[idx];
  let html = `<div class="tt-title">Candidate #${c.id + 1}${c.isInlier ? ' 💘' : ''}</div>`;
  DIMS.forEach((d, j) => {
    html += `<div class="tt-row"><span class="tt-key">${d.short}</span><span class="tt-val">${c.raw[j].toFixed(1)}${d.unit}</span></div>`;
  });
  if (c.residual !== null) {
    html += `<div class="tt-row" style="margin-top:0.2rem"><span class="tt-key">Residual (r)</span><span class="tt-val" style="color:#FF8B94">${c.residual.toFixed(4)}</span></div>`;
  }
  tooltip.innerHTML = html;
  const pad = 14;
  let left = clientX + pad;
  let top  = clientY - 10;
  if (left + 230 > window.innerWidth)  left = clientX - 230 - pad;
  if (top  + 250 > window.innerHeight) top  = clientY - 250;
  tooltip.style.left = `${left}px`;
  tooltip.style.top  = `${top}px`;
  tooltip.classList.add('visible');
}

// ── Formula hover ─────────────────────────────────────────────────────────────
function bindFormulaHover() {
  formulaText.querySelectorAll('tr[data-dim]').forEach(el => {
    el.addEventListener('mouseenter', () => {
      const d = DIMS[+el.dataset.dim];
      if (!d) return;
      const rect = el.getBoundingClientRect();
      const isZh  = S.lang === 'zh';
      const title = isZh ? (d.labelZh || d.label) : d.label;
      const body  = isZh ? (d.tipZh   || d.tip)   : d.tip;
      tooltip.innerHTML =
        `<div class="tt-title">${title} <span style="font-weight:400;color:var(--text-sub)">(${d.min}–${d.max}${d.unit})</span></div>`
        + `<div style="margin-top:0.2rem;line-height:1.6">${body}</div>`;
      let left = rect.left - 275;
      let top  = rect.top - 8;
      if (left < 0) left = rect.right + 10;
      if (top  + 120 > window.innerHeight) top = window.innerHeight - 130;
      tooltip.style.left = `${left}px`;
      tooltip.style.top  = `${top}px`;
      tooltip.classList.add('visible');
    });
    el.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
  });
}

// ── Modal content ─────────────────────────────────────────────────────────────
const MODAL = {
  en: `
<p><strong>RANSAC (Random Sample Consensus)</strong> is a robust estimation algorithm that fits a model to noisy, outlier-contaminated data. Here we use it to identify soul-match inliers hidden among candidates in an 8-dimensional feature space.</p>
<p><strong>Ground Truth:</strong> Each candidate has an 8-D feature vector $\\mathbf{x} \\in \\mathbb{R}^8$. The hidden compatibility score follows:</p>
<p>$$Y = \\mathbf{w}_{\\text{true}}^\\top \\mathbf{x} + b + \\varepsilon, \\quad \\varepsilon \\sim \\mathcal{N}(0, \\sigma^2)$$</p>
<p>Outliers have random $Y$ values uncorrelated with $\\mathbf{x}$.</p>
<p><strong>The 8 Dimensions of True Love (Feature Vector Field Guide):</strong></p>
<table style="width:100%;border-collapse:collapse;font-size:0.75rem;margin-bottom:0.7rem;">
  <thead><tr style="border-bottom:1px solid rgba(255,139,148,0.3);">
    <th style="text-align:left;padding:0.3rem 0.5rem;color:#FF8B94;">Dimension</th>
    <th style="text-align:left;padding:0.3rem 0.5rem;color:#FF8B94;">Range</th>
    <th style="text-align:left;padding:0.3rem 0.5rem;color:#FF8B94;">What it really tests</th>
  </tr></thead>
  <tbody>
    <tr style="border-bottom:1px solid rgba(178,172,136,0.15);">
      <td style="padding:0.32rem 0.5rem;font-weight:700;">$x_1$ Cilantro Tolerance</td>
      <td style="padding:0.32rem 0.5rem;color:#8a7a7a;">0 – 100</td>
      <td style="padding:0.32rem 0.5rem;">Can you share a plate without gagging? The ultimate culinary dealbreaker. Score 0 = "get that soap away from me", Score 100 = ordering extra cilantro on everything.</td>
    </tr>
    <tr style="border-bottom:1px solid rgba(178,172,136,0.15);">
      <td style="padding:0.32rem 0.5rem;font-weight:700;">$x_2$ Cloud Invoice Rate</td>
      <td style="padding:0.32rem 0.5rem;color:#8a7a7a;">0 – 100%</td>
      <td style="padding:0.32rem 0.5rem;">How often do you actually use the government e-invoice carrier instead of printing? A proxy for civic responsibility, tax-law awareness, and whether you own a smartphone made after 2018.</td>
    </tr>
    <tr style="border-bottom:1px solid rgba(178,172,136,0.15);">
      <td style="padding:0.32rem 0.5rem;font-weight:700;">$x_3$ Threads Shitposting Idx</td>
      <td style="padding:0.32rem 0.5rem;color:#8a7a7a;">0 – 20 /day</td>
      <td style="padding:0.32rem 0.5rem;">Daily volume of low-effort content fired into the void. 0 = lurker with opinions, 20 = chronically online. Your soul match posts exactly as much as you do—no more, no less.</td>
    </tr>
    <tr style="border-bottom:1px solid rgba(178,172,136,0.15);">
      <td style="padding:0.32rem 0.5rem;font-weight:700;">$x_4$ AC Temp Preference</td>
      <td style="padding:0.32rem 0.5rem;color:#8a7a7a;">16 – 30 °C</td>
      <td style="padding:0.32rem 0.5rem;">The thermostat is the number-one source of relationship conflict after the toilet seat. 16°C = penguin mode, 30°C = "why is the AC even on?" A 2°C gap is manageable; 8°C is a dealbreaker.</td>
    </tr>
    <tr style="border-bottom:1px solid rgba(178,172,136,0.15);">
      <td style="padding:0.32rem 0.5rem;font-weight:700;">$x_5$ Mysticism Belief</td>
      <td style="padding:0.32rem 0.5rem;color:#8a7a7a;">0 – 100</td>
      <td style="padding:0.32rem 0.5rem;">How much do you believe Mercury retrograde ruined your pull request? 0 = "correlation ≠ causation" 100 = won't deploy on a void-of-course moon. Extreme mismatch causes irreconcilable epistemological differences.</td>
    </tr>
    <tr style="border-bottom:1px solid rgba(178,172,136,0.15);">
      <td style="padding:0.32rem 0.5rem;font-weight:700;">$x_6$ Mute Speed</td>
      <td style="padding:0.32rem 0.5rem;color:#8a7a7a;">0 – 60 s</td>
      <td style="padding:0.32rem 0.5rem;">Seconds until you mute the family/classmate group chat after a new message appears. 0 = reflexive mute (you're spiritually exhausted), 60 = masochist who reads every forward. A shared mute strategy is the bedrock of domestic peace.</td>
    </tr>
    <tr style="border-bottom:1px solid rgba(178,172,136,0.15);">
      <td style="padding:0.32rem 0.5rem;font-weight:700;">$x_7$ Ghosting Resilience</td>
      <td style="padding:0.32rem 0.5rem;color:#8a7a7a;">1 – 10</td>
      <td style="padding:0.32rem 0.5rem;">Psychological recovery coefficient after being left on read. 1 = you're still refreshing their profile two years later, 10 = "who? anyway, here's my new project." High resilience is admirable; perfect score may indicate emotional unavailability.</td>
    </tr>
    <tr>
      <td style="padding:0.32rem 0.5rem;font-weight:700;">$x_8$ Work Originality</td>
      <td style="padding:0.32rem 0.5rem;color:#8a7a7a;">0 – 100</td>
      <td style="padding:0.32rem 0.5rem;">Of the things you confidently call "your own work," what fraction did you actually produce? 0 = copy-pasted the ChatGPT output, changed the font, and submitted it as original, 100 = you can explain every sentence in your own words without looking at the source. Your soul match operates at exactly the same level of plausible deniability as you do.</td>
    </tr>
  </tbody>
</table>
<p><strong>Algorithm (per iteration):</strong></p>
<p>1. Draw a random sample $\\mathcal{S}$ of $k = 9$ candidates (minimum to solve for $\\mathbf{w} \\in \\mathbb{R}^8$ and $b$).</p>
<p>2. Solve the linear system $X_{\\mathcal{S}}\\, \\hat{\\boldsymbol{\\theta}} = \\mathbf{y}_{\\mathcal{S}}$ via Gaussian elimination, where each row is $[x_1,\\ldots,x_8,\\, 1]$.</p>
<p>3. Compute per-point residuals: $r_i = \\left| y_i - \\hat{\\boldsymbol{\\theta}}^\\top [\\mathbf{x}_i; 1] \\right|$</p>
<p>4. Consensus set: $\\mathcal{C} = \\{i : r_i < \\tau\\}$. If $|\\mathcal{C}| > |\\mathcal{C}_{\\text{best}}|$, update the best model.</p>
<p><strong>What is a Residual?</strong> The residual $r_i$ measures how wrong the model is for candidate $i$ — specifically, the absolute gap between the candidate's actual compatibility score $y_i$ and the score the current model would predict: $\\hat{y}_i = \\hat{\\mathbf{w}}^\\top \\mathbf{x}_i + \\hat{b}$. A small residual means the model explains this candidate well (likely a true soul match); a large residual means the model cannot account for their score (likely an outlier playing pretend). The threshold $\\tau$ is the cutoff: anyone with $r_i &lt; \\tau$ gets admitted into the consensus set. The <em>Min / Max / Avg</em> residuals shown in the True Love Formula panel are computed over all 100 candidates using the final fitted model — a low average with a tight range indicates the model has genuinely found the hyperplane of love.</p>
<p><strong>What is the Threshold τ?</strong> The threshold $\\tau$ is the tolerance you grant to each candidate when deciding whether they "fit" the current model. After computing the residual $r_i$ for every candidate, only those with $r_i &lt; \\tau$ are admitted into the consensus set. Setting $\\tau$ too small means almost nobody qualifies and RANSAC struggles to build any consensus at all. Setting $\\tau$ too large lets outliers sneak in, polluting the consensus set and degrading the final model. In this demo the slider maps 1–30 linearly to $\\tau = 0.01$–$0.30$ in the normalized $Y$ space (which lives in $[0, 1]$), so the default value of 5 means "accept any candidate whose predicted compatibility is within ±0.05 of their actual score" — roughly 1.7× the maximum inlier noise level.</p>
<p><strong>Why it works:</strong> Let $\\rho$ be the inlier fraction (adjustable via the Soul Matchers slider). The probability of drawing $k=9$ pure inliers in one sample is $\\rho^9$. After $T$ iterations the success probability reaches $1 - (1-\\rho^9)^T$. For example at $\\rho=0.5$: $T=100$ gives ~18%, $T=500$ exceeds 63%. After RANSAC identifies the best consensus set, we additionally refit with <strong>Ordinary Least Squares</strong> on all consensus members — this dramatically sharpens the final weights even from an imperfect initial sample.</p>
`,
  zhTW: `
<p><strong>RANSAC（隨機樣本共識）</strong>是一種強健的模型估計演算法，可在含有大量 Outlier 的資料中找出正確模型。這裡我們用它在 8 維特徵空間中，從候選人裡揪出藏匿其中的真愛戰士。</p>
<p><strong>真理定義：</strong>每位候選人有一個 8 維特徵向量 $\\mathbf{x} \\in \\mathbb{R}^8$。隱藏的相容性分數符合：</p>
<p>$$Y = \\mathbf{w}_{\\text{true}}^\\top \\mathbf{x} + b + \\varepsilon, \\quad \\varepsilon \\sim \\mathcal{N}(0, \\sigma^2)$$</p>
<p>Outlier 的 $Y$ 值是隨機的，與 $\\mathbf{x}$ 毫無關聯。</p>
<p><strong>真愛的 8 個維度（特徵向量田野調查報告）：</strong></p>
<table style="width:100%;border-collapse:collapse;font-size:0.75rem;margin-bottom:0.7rem;">
  <thead><tr style="border-bottom:1px solid rgba(255,139,148,0.3);">
    <th style="text-align:left;padding:0.3rem 0.5rem;color:#FF8B94;">維度</th>
    <th style="text-align:left;padding:0.3rem 0.5rem;color:#FF8B94;">範圍</th>
    <th style="text-align:left;padding:0.3rem 0.5rem;color:#FF8B94;">它真正在測什麼</th>
  </tr></thead>
  <tbody>
    <tr style="border-bottom:1px solid rgba(178,172,136,0.15);">
      <td style="padding:0.32rem 0.5rem;font-weight:700;">$x_1$ 香菜耐受度</td>
      <td style="padding:0.32rem 0.5rem;color:#8a7a7a;">0 – 100</td>
      <td style="padding:0.32rem 0.5rem;">你能不能跟對方共用同一盤菜而不翻臉？0 分 = 「那是肥皂吧」，100 分 = 叫外送必加「香菜加倍」。飲食觀的根本分歧，任何演算法都難以彌合。</td>
    </tr>
    <tr style="border-bottom:1px solid rgba(178,172,136,0.15);">
      <td style="padding:0.32rem 0.5rem;font-weight:700;">$x_2$ 發票載具使用率</td>
      <td style="padding:0.32rem 0.5rem;color:#8a7a7a;">0 – 100%</td>
      <td style="padding:0.32rem 0.5rem;">你有多常用手機載具而不是索取紙本？這個數字反映你的公民意識、對稅法的了解程度，以及你的手機是否在 2018 年之後製造。</td>
    </tr>
    <tr style="border-bottom:1px solid rgba(178,172,136,0.15);">
      <td style="padding:0.32rem 0.5rem;font-weight:700;">$x_3$ Threads 廢文產出指數</td>
      <td style="padding:0.32rem 0.5rem;color:#8a7a7a;">0 – 20 篇/天</td>
      <td style="padding:0.32rem 0.5rem;">每天發多少低努力含量的內容進虛空？0 = 有想法但只看不發，20 = 嚴重網路成癮。真愛的條件：對方發廢文的頻率跟你完全一致，不多也不少。</td>
    </tr>
    <tr style="border-bottom:1px solid rgba(178,172,136,0.15);">
      <td style="padding:0.32rem 0.5rem;font-weight:700;">$x_4$ 空調偏好溫度</td>
      <td style="padding:0.32rem 0.5rem;color:#8a7a7a;">16 – 30 °C</td>
      <td style="padding:0.32rem 0.5rem;">冷氣溫度是所有長期關係衝突的第一來源（略勝馬桶蓋）。16°C = 企鵝模式，30°C = 「冷氣開著幹嘛」。2°C 的差距還可以協商；超過 8°C 請直接分手。</td>
    </tr>
    <tr style="border-bottom:1px solid rgba(178,172,136,0.15);">
      <td style="padding:0.32rem 0.5rem;font-weight:700;">$x_5$ 神祕學迷信程度</td>
      <td style="padding:0.32rem 0.5rem;color:#8a7a7a;">0 – 100</td>
      <td style="padding:0.32rem 0.5rem;">你有多相信水星逆行毀了你的 pull request？0 = 「相關性不等於因果」，100 = 月亮空亡不 deploy。極端不匹配會導致無法調和的認識論分歧，程式 debug 時尤其致命。</td>
    </tr>
    <tr style="border-bottom:1px solid rgba(178,172,136,0.15);">
      <td style="padding:0.32rem 0.5rem;font-weight:700;">$x_6$ 群組靜音反射時間</td>
      <td style="padding:0.32rem 0.5rem;color:#8a7a7a;">0 – 60 秒</td>
      <td style="padding:0.32rem 0.5rem;">家族群組或同學群組傳來新訊息後，你幾秒內靜音？0 = 反射動作（你已經精神疲憊），60 = 還在看完所有轉發訊息的受虐狂。共同的靜音策略是家庭和平的基石。</td>
    </tr>
    <tr style="border-bottom:1px solid rgba(178,172,136,0.15);">
      <td style="padding:0.32rem 0.5rem;font-weight:700;">$x_7$ 被放鳥復原係數</td>
      <td style="padding:0.32rem 0.5rem;color:#8a7a7a;">1 – 10</td>
      <td style="padding:0.32rem 0.5rem;">被已讀不回之後的心理復原速度。1 = 兩年後還在反覆看對方的限時動態，10 = 「誰？算了，來看我的新 side project」。高分令人欽佩；滿分可能代表迴避型依附。</td>
    </tr>
    <tr>
      <td style="padding:0.32rem 0.5rem;font-weight:700;">$x_8$ 作品原創純度</td>
      <td style="padding:0.32rem 0.5rem;color:#8a7a7a;">0 – 100</td>
      <td style="padding:0.32rem 0.5rem;">你說的「我做的」有幾成真的是你做的？0 = 整份報告讓 AI 生成，改了字型跟抬頭就交出去，然後在會議上口若懸河地介紹「我的想法」；100 = 每一句你都能用自己的話再說一遍，包括那個你其實借鑑別人但沒提的段落。真愛就是找到一個跟你「誠實程度」剛好一樣的人，多一分嫌對方偽善，少一分嫌對方沒自信。</td>
    </tr>
  </tbody>
</table>
<p><strong>演算法（每次迭代）：</strong></p>
<p>1. 隨機抽取 $k = 9$ 位候選人組成樣本集 $\\mathcal{S}$（恰好足以求解 8 個權重 $\\mathbf{w}$ 加 1 個截距 $b$）。</p>
<p>2. 用高斯消去法解線性方程組 $X_{\\mathcal{S}}\\, \\hat{\\boldsymbol{\\theta}} = \\mathbf{y}_{\\mathcal{S}}$，每列為 $[x_1,\\ldots,x_8,\\, 1]$。</p>
<p>3. 計算所有點的殘差：$r_i = \\left| y_i - \\hat{\\boldsymbol{\\theta}}^\\top [\\mathbf{x}_i; 1] \\right|$</p>
<p>4. Consensus Set：$\\mathcal{C} = \\{i : r_i < \\tau\\}$。若 $|\\mathcal{C}| > |\\mathcal{C}_{\\text{best}}|$ 則更新最佳模型。</p>
<p><strong>殘差（Residual）是什麼？</strong>殘差 $r_i$ 衡量目前模型對第 $i$ 位候選人的預測誤差，即實際相容分數 $y_i$ 與模型預測值 $\\hat{y}_i = \\hat{\\mathbf{w}}^\\top \\mathbf{x}_i + \\hat{b}$ 之間的絕對差距。殘差小 → 模型能解釋這位候選人的分數 → 很可能是真愛戰士；殘差大 → 模型無法說明其分數 → 很可能是演技派。閾值 $\\tau$ 是入圍門檻：只要 $r_i &lt; \\tau$ 就能進入 Consensus Set。True Love Formula 面板下方顯示的 <em>最小 / 最大 / 平均</em>殘差，是用最終擬合模型對全部 100 位候選人計算的——平均值低且範圍緊表示模型確實找到了那條愛的超平面。</p>
<p><strong>Threshold τ 是什麼？</strong>閾值 $\\tau$ 是判斷某位候選人「算不算支持目前模型」的容忍距離。計算出每位候選人的殘差 $r_i$ 後，只有 $r_i &lt; \\tau$ 的人才能進入 Consensus Set。$\\tau$ 設太小 → 幾乎沒人達標，RANSAC 難以建立共識；$\\tau$ 設太大 → Outlier 也能混入，污染 Consensus Set，最終模型失準。在這個介面中，滑桿範圍 1–30 線性對應 $\\tau = 0.01$–$0.30$（單位是正規化後的 $Y$ 空間，值域 $[0, 1]$），因此預設滑桿值 5 代表：「預測相容性分數與實際分數相差在 ±0.05 以內的候選人都算符合」，約為 Inlier 最大雜訊的 1.7 倍，留有適當餘裕又不易被 Outlier 污染。</p>
<p><strong>為什麼有效：</strong>設 $\\rho$ 為 Inlier 比例（可透過 Soul Matchers 滑桿調整）。一次抽到 $k=9$ 個純 Inlier 的機率為 $\\rho^9$，成功機率公式為 $1-(1-\\rho^9)^T$。以 $\\rho=0.5$ 為例：$T=100$ 時約 18%，$T=500$ 時超過 63%。此外，找到最佳 Consensus Set 後，會對其所有成員執行<strong>普通最小二乘法（OLS）</strong>重新擬合，大幅提升最終權重精度。</p>
`,
};

function renderModal() {
  const langKey = S.lang === 'zh' ? 'zhTW' : 'en';
  modalBody.innerHTML = MODAL[langKey] || MODAL.en;
  if (window.renderMathInElement) {
    window.renderMathInElement(modalBody, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
      ],
    });
  }
}

// ── Populate axis selects ─────────────────────────────────────────────────────
function populateSelects() {
  DIMS.forEach((d, i) => {
    selX.add(new Option(d.label, i));
    selY.add(new Option(d.label, i));
  });
  selX.value = 0;
  selY.value = 1;
}

// ── Event wiring ──────────────────────────────────────────────────────────────
selX.addEventListener('change', () => { S.axisX = +selX.value; updateTargets(); updateAxisLabels(); });
selY.addEventListener('change', () => { S.axisY = +selY.value; updateTargets(); updateAxisLabels(); });

function toggleBtn(btn, key) {
  S[key] = !S[key];
  btn.classList.toggle('active', S[key]);
}
btnInliers.addEventListener('click',  () => toggleBtn(btnInliers,  'showInliers'));
btnOutliers.addEventListener('click', () => toggleBtn(btnOutliers, 'showOutliers'));
btnTruth.addEventListener('click',    () => toggleBtn(btnTruth,    'showTruth'));

ctrlIter.addEventListener('input',   () => { valIter.textContent   = ctrlIter.value; });
ctrlThresh.addEventListener('input', () => { valThresh.textContent = ctrlThresh.value; });

ctrlSouls.addEventListener('input', () => {
  valSouls.textContent = ctrlSouls.value;
  S.nInliers = +ctrlSouls.value;
  updateSubtitle();
  resetRANSACState();
  generateData();
  updateTargets();
  S.positions = S.targets.map(t => ({ ...t }));
});

resetBtn.addEventListener('click', () => {
  ctrlIter.value    = DEFAULTS.maxIter;   valIter.textContent   = DEFAULTS.maxIter;
  ctrlThresh.value  = DEFAULTS.threshold; valThresh.textContent = DEFAULTS.threshold;
  ctrlSouls.value   = DEFAULTS.nInliers;  valSouls.textContent  = DEFAULTS.nInliers;
  S.nInliers = DEFAULTS.nInliers;
  updateSubtitle();
  resetRANSACState();
  generateData();
  updateTargets();
  S.positions = S.targets.map(t => ({ ...t }));
});

btnRun.addEventListener('click', () => {
  if (S.running) return;
  resetRANSACState();

  S.running   = true;
  S.maxIter   = +ctrlIter.value;
  S.threshold = +ctrlThresh.value / 100;
  S.nInliers  = +ctrlSouls.value;

  btnRun.disabled = true;
  btnRun.textContent = I18N[S.lang].btnRunning;

  // Reset residuals
  S.candidates.forEach(c => { c.residual = null; });
  ransacStep();
});

canvas.addEventListener('mousemove', e => {
  const r  = canvas.getBoundingClientRect();
  const idx = hitTest(e.clientX - r.left, e.clientY - r.top);
  S.hoveredIdx = idx;
  if (idx !== null) showTooltip(idx, e.clientX, e.clientY);
  else tooltip.classList.remove('visible');
});
canvas.addEventListener('mouseleave', () => {
  S.hoveredIdx = null;
  tooltip.classList.remove('visible');
});

mathBtn.addEventListener('click', () => { renderModal(); mathModal.classList.add('open'); });
closeModal.addEventListener('click', () => mathModal.classList.remove('open'));
mathModal.addEventListener('click', e => { if (e.target === mathModal) mathModal.classList.remove('open'); });

globalLangBtn.addEventListener('click', () => {
  S.lang = S.lang === 'en' ? 'zh' : 'en';
  applyLang();
  renderFormula();
});

window.addEventListener('resize', resizeCanvas);

// ── Axis labels ───────────────────────────────────────────────────────────────
function updateAxisLabels() {
  axisXLabel.textContent = DIMS[S.axisX].short;
  axisYLabel.textContent = DIMS[S.axisY].short;
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  generateData();
  populateSelects();
  resizeCanvas();
  S.positions = S.targets.map(t => ({ ...t }));
  updateAxisLabels();
  updateSubtitle();
  renderFormula(); // show GT weights immediately on load
  requestAnimationFrame(render);
}

init();
