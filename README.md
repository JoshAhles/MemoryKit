# MemoryKit Landing Page

Static, single-screen landing page for **MemoryKit** — a persistent, user-owned memory layer for AI.  
Designed for GitHub Pages, dark mode by default, with a 3D brain visual anchor and a simple waitlist form.

## Tech stack

- **Static HTML/CSS/JS only** – no backend, no build step required
- **Modular ES modules** under `src/js` and layered styles under `src/styles`
- Canvas-based 3D-like brain visualization (easily swappable for a full WebGL/Three.js scene later)

## Local development

You can open `index.html` directly in a modern browser, or run a simple static server:

```bash
python -m http.server 4173
```

Then visit `http://localhost:4173` and open `index.html`.

## Deployment to GitHub Pages

For a basic user/organization page:

1. Push this repository to GitHub as `<username>.github.io`
2. Ensure `index.html` is at the repo root (as in this project)
3. GitHub Pages will automatically serve the site from the default branch

For a project page:

1. Push to any repo
2. In **Settings → Pages**, choose:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` (or your default) and `/ (root)`
3. Save – GitHub will publish the site at the indicated URL

## Customization points

- **Copy & messaging**: edit hero and reinforcement copy in `index.html`
- **Theme & layout**: adjust tokens and layout in `src/styles/base.css` and `src/styles/theme.css`
- **3D brain**:
  - Current implementation: `src/js/brainScene.js` (canvas-based, lightweight)
  - To upgrade to Three.js/WebGL: replace `initBrainScene` with your implementation while keeping the same signature
- **Waitlist form**:
  - Logic lives in `src/js/waitlistForm.js`
  - Currently client-only; wire it up to your email/waitlist provider by replacing the placeholder section in the submit handler

## Notes

- No secrets, API keys, or private data should live in this repo.
- The page favors:
  - Clear, sparse copy
  - Fast initial load
  - Semantic markup for SEO (`<main>`, `<header>`, `<section>`, `<footer>`)

