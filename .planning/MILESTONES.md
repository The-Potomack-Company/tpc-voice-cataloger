# Milestones

## v1.0 MVP (Shipped: 2026-03-17)

**Phases completed:** 10 phases, 27 plans
**Stats:** 214 commits | 232 files | 9,166 LOC (TS/TSX/JS) | 11 days (2026-03-06 → 2026-03-17)

**Key accomplishments:**
1. PWA shell with bottom-tab navigation, install banner, walkthrough, and 48px+ tap targets
2. Tap-to-record audio on iOS Safari + Android Chrome with local IndexedDB storage
3. Full session lifecycle — create, save, resume, complete, and archive across browser close
4. Two cataloging modes — house visit (photos + sequential items) and sale (receipt number + dictation)
5. Gemini AI pipeline — single-call transcription + structured field extraction via Cloudflare Worker proxy
6. Measurements field with auto-formatting (N×N×N in./cm.) flowing through UI, export, and extension
7. Chrome extension batch import — fills RFC Invaluable lot pages by receipt number from exported JSON
8. Offline queue — records without connectivity, auto-drains on reconnect
9. Export history with versioned filenames, session archiving, and receipt import from CSV/XLSX

**Known Gaps (accepted as tech debt):**
- DEPLOY-01: App not yet deployed to Vercel with auto-deploy from main
- DEPLOY-02: CI pipeline (lint, typecheck, test, build) not yet configured via GitHub Actions
- DEPLOY-03: Cloudflare Worker CORS still uses wildcard origin (not restricted to production domain)
- DEPLOY-04: Branch protection on main not yet configured

---

