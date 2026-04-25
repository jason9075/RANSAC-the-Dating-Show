'use strict';

// ── Dimension definitions ──────────────────────────────────────────────────────
const DIMS = [
  { key: 'cilantro',  label: 'Cilantro Tolerance',        short: 'Cilantro',  min: 0,  max: 100, unit: '' },
  { key: 'invoice',   label: 'Cloud Invoice Rate',         short: 'Invoice',   min: 0,  max: 100, unit: '%' },
  { key: 'threads',   label: 'Threads Shitposting Idx',   short: 'Threads',   min: 0,  max: 20,  unit: '/day' },
  { key: 'actemp',    label: 'AC Temp Preference',         short: 'AC Temp',   min: 16, max: 30,  unit: '°C' },
  { key: 'mysticism', label: 'Mysticism Belief',           short: 'Mysticism', min: 0,  max: 100, unit: '' },
  { key: 'mute',      label: 'Mute Speed',                 short: 'Mute',      min: 0,  max: 60,  unit: 's' },
  { key: 'ghosting',  label: 'Ghosting Resilience',        short: 'Ghosting',  min: 1,  max: 10,  unit: '' },
  { key: 'dotfiles',  label: 'Dotfiles Authenticity',      short: 'Dotfiles',  min: 0,  max: 100, unit: '' },
];

const N_TOTAL   = 100;
const N_INLIERS = 20;
const RANSAC_K  = 9; // 8 weights + 1 bias = 9 unknowns

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
  maxIter:   50,
  threshold: 0.10,
  positions: [],  // current canvas coords [{cx,cy}]
  targets:   [],  // target  canvas coords [{cx,cy}]
  hoveredIdx: null,
  heartbeat:  0,
  modalLang: 'en',
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
const mathBtn     = document.getElementById('math-btn');
const closeModal  = document.getElementById('close-modal');
const langToggle  = document.getElementById('lang-toggle');

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
    const isInlier = i < N_INLIERS;
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

function triggerGlow() {
  glowEl.style.opacity = '1';
  setTimeout(() => { glowEl.style.opacity = '0'; }, 280);
}

function finishRANSAC() {
  S.running = false;
  S.done    = true;
  btnRun.disabled = false;
  btnRun.textContent = '▶ Run Again';

  if (S.bestWeights) {
    const lines = S.bestWeights.map((w, i) =>
      `${w >= 0 ? '+' : ''}${w.toFixed(3)} × ${DIMS[i].short}`
    );
    formulaText.textContent =
      'Y = ' + lines.join('\n    ') +
      `\n    ${S.bestBias >= 0 ? '+' : ''}${S.bestBias.toFixed(3)}`;
    formulaPanel.classList.add('visible');
  }

  resultSub.textContent = `${S.bestConsensus} soul matches found in ${S.maxIter} iterations`;
  resultBanner.classList.add('visible');
  setTimeout(() => resultBanner.classList.remove('visible'), 3500);
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

// ── Modal content ─────────────────────────────────────────────────────────────
const MODAL = {
  en: `
<p><strong>RANSAC (Random Sample Consensus)</strong> is a robust estimation algorithm that fits a model to noisy, outlier-contaminated data. Here we use it to identify 20 "soul-match" inliers among 100 candidates in an 8-dimensional feature space.</p>
<p><strong>Ground Truth:</strong> Each candidate has an 8-D feature vector $\\mathbf{x} \\in \\mathbb{R}^8$. The hidden compatibility score follows:</p>
<p>$$Y = \\mathbf{w}_{\\text{true}}^\\top \\mathbf{x} + b + \\varepsilon, \\quad \\varepsilon \\sim \\mathcal{N}(0, \\sigma^2)$$</p>
<p>Outliers have random $Y$ values uncorrelated with $\\mathbf{x}$.</p>
<p><strong>Algorithm (per iteration):</strong></p>
<p>1. Draw a random sample $\\mathcal{S}$ of $k = 9$ candidates (minimum to solve for $\\mathbf{w} \\in \\mathbb{R}^8$ and $b$).</p>
<p>2. Solve the linear system $X_{\\mathcal{S}}\\, \\hat{\\boldsymbol{\\theta}} = \\mathbf{y}_{\\mathcal{S}}$ via Gaussian elimination, where each row is $[x_1,\\ldots,x_8,\\, 1]$.</p>
<p>3. Compute per-point residuals: $r_i = \\left| y_i - \\hat{\\boldsymbol{\\theta}}^\\top [\\mathbf{x}_i; 1] \\right|$</p>
<p>4. Consensus set: $\\mathcal{C} = \\{i : r_i < \\tau\\}$. If $|\\mathcal{C}| > |\\mathcal{C}_{\\text{best}}|$, update the best model.</p>
<p><strong>Why it works:</strong> With inlier fraction $\\rho = 0.2$, the probability of drawing $k=9$ inliers is $\\rho^9 \\approx 5 \\times 10^{-7}$—very small. But after $T$ iterations the success probability reaches $1 - (1-\\rho^9)^T$. In practice, even partial inlier contamination yields a large consensus set that grows quickly above the outlier baseline.</p>
`,
  zhTW: `
<p><strong>RANSAC（隨機樣本共識）</strong>是一種強健的模型估計演算法，可在含有大量 Outlier 的資料中找出正確模型。這裡我們用它在 8 維特徵空間中，從 100 位候選人裡揪出 20 位「真愛戰士」。</p>
<p><strong>真理定義：</strong>每位候選人有一個 8 維特徵向量 $\\mathbf{x} \\in \\mathbb{R}^8$。隱藏的相容性分數符合：</p>
<p>$$Y = \\mathbf{w}_{\\text{true}}^\\top \\mathbf{x} + b + \\varepsilon, \\quad \\varepsilon \\sim \\mathcal{N}(0, \\sigma^2)$$</p>
<p>Outlier 的 $Y$ 值是隨機的，與 $\\mathbf{x}$ 毫無關聯。</p>
<p><strong>演算法（每次迭代）：</strong></p>
<p>1. 隨機抽取 $k = 9$ 位候選人組成樣本集 $\\mathcal{S}$（恰好足以求解 8 個權重 $\\mathbf{w}$ 加 1 個截距 $b$）。</p>
<p>2. 用高斯消去法解線性方程組 $X_{\\mathcal{S}}\\, \\hat{\\boldsymbol{\\theta}} = \\mathbf{y}_{\\mathcal{S}}$，每列為 $[x_1,\\ldots,x_8,\\, 1]$。</p>
<p>3. 計算所有點的殘差：$r_i = \\left| y_i - \\hat{\\boldsymbol{\\theta}}^\\top [\\mathbf{x}_i; 1] \\right|$</p>
<p>4. Consensus Set：$\\mathcal{C} = \\{i : r_i < \\tau\\}$。若 $|\\mathcal{C}| > |\\mathcal{C}_{\\text{best}}|$ 則更新最佳模型。</p>
<p><strong>為什麼有效：</strong>Inlier 比例 $\\rho = 0.2$，一次抽到 $k=9$ 個 Inlier 的機率為 $\\rho^9 \\approx 5 \\times 10^{-7}$，看似渺茫。但即使只有部分 Inlier 進入樣本，模型仍能涵蓋大量真愛戰士，讓 Consensus Set 遠超 Outlier 的隨機基準，迭代足夠多次後即可找到最大共識集。</p>
`,
};

function renderModal() {
  modalBody.innerHTML = MODAL[S.modalLang] || MODAL.en;
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

btnRun.addEventListener('click', () => {
  if (S.running) return;
  if (ransacTimer) clearTimeout(ransacTimer);

  S.running      = true;
  S.done         = false;
  S.currentIter  = 0;
  S.bestConsensus= 0;
  S.bestSet      = new Set();
  S.bestWeights  = null;
  S.maxIter      = +ctrlIter.value;
  S.threshold    = +ctrlThresh.value / 100;

  formulaPanel.classList.remove('visible');
  resultBanner.classList.remove('visible');
  progressBar.style.width = '0%';
  statIter.textContent  = '—';
  statCons.textContent  = '—';
  statMax.textContent   = '—';
  statResid.textContent = '—';
  btnRun.disabled = true;
  btnRun.textContent = '⏳ Running...';

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
langToggle.addEventListener('click', () => {
  S.modalLang = S.modalLang === 'en' ? 'zhTW' : 'en';
  renderModal();
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
  requestAnimationFrame(render);
}

init();
