# 💘 RANSAC — The Dating Show

> *Finding true love in 8 dimensions. 100 candidates. 20 soul matches hidden within.*

**Live Demo → [https://jason9075.github.io/RANSAC-the-Dating-Show](https://jason9075.github.io/RANSAC-the-Dating-Show)**

---

## What is this?

A tongue-in-cheek interactive visualization of the **RANSAC** (Random Sample Consensus) algorithm, dressed up as an 8-dimensional dating reality show.

100 candidates attend. 20 secretly follow the True Love Formula. 80 are just acting. RANSAC's job: find them.

## The 8D Feature Vector

Each candidate is scored across 8 scientifically dubious but deeply revealing dimensions:

| # | Dimension | Range | What it really tests |
|---|-----------|-------|----------------------|
| x₁ | Cilantro Tolerance | 0–100 | The ultimate culinary dealbreaker |
| x₂ | Cloud Invoice Rate | 0–100% | Civic responsibility proxy |
| x₃ | Threads Shitposting Index | 0–20 /day | Chronic online-ness |
| x₄ | AC Temp Preference | 16–30 °C | #1 source of relationship conflict |
| x₅ | Mysticism Belief | 0–100 | Mercury retrograde believer? |
| x₆ | Mute Speed | 0–60 s | Family group chat survival reflex |
| x₇ | Ghosting Resilience | 1–10 | Recovery from being left on read |
| x₈ | Dotfiles Authenticity | 0–100 | How much of your "work" is actually yours? |

## How it Works

The hidden ground truth is a linear hyperplane in 8D space:

$$Y = \mathbf{w}_{\text{true}}^\top \mathbf{x} + b + \varepsilon$$

The 20 inliers satisfy this formula (with small noise ε). The 80 outliers have random Y values.

**RANSAC per iteration:**
1. Randomly sample k = 9 candidates
2. Solve the 9×9 linear system via Gaussian elimination → get candidate weights **ŵ**
3. Compute residuals rᵢ = |yᵢ − **ŵ**ᵀxᵢ| for all 100 points
4. Consensus Set = { i : rᵢ < τ }
5. If largest consensus set so far → update best model

## Features

- **Scatter plot** — project any 2 of the 8 dimensions onto X/Y axes with fluid lerp transitions
- **God Mode toggles** — reveal inliers (💗 heartbeat animation), fade outliers, draw ground truth regression line with residual drops
- **Algorithm Monitor** — live RANSAC Iteration, Consensus Set Size, Max Consensus Found, Model Residual
- **Hover tooltip** — 8D data + individual residual for every candidate dot
- **True Love Formula** — displayed after RANSAC completes; hover each dimension for its description
- **Convergence glow** — pink edge halo fires whenever a new best model is found
- **Singular matrix warning** — shown inline when Gaussian elimination fails
- **💡 Math modal** — full RANSAC math explanation with KaTeX, switchable Eng / 中

## Running Locally

```sh
# Enter dev shell (requires Nix)
nix develop
# or: direnv allow

# Start live-server at http://localhost:8080
just dev
```

No build step. Pure HTML + vanilla JS + Canvas 2D API.

## Tech Stack

- **Rendering** — Canvas 2D API (no WebGL, no framework)
- **Math typesetting** — [KaTeX](https://katex.org/)
- **Dev environment** — Nix flake + `live-server` + `just`

## License

MIT
