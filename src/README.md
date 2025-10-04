MLBB Quick Draft Coach
MLBB Quick Draft Coach is a Vite + React single-page assistant that helps Mobile Legends: Bang Bang players navigate hero drafts with resilient data loading, strategy heuristics, and actionable in-game checklists.

Key Features
Robust data sourcing: Attempts the ridwaanhall Stats API directly, then cascades across multiple open proxies before falling back to the MLBB Wiki or a bundled roster so the app keeps working even when CORS blocks direct calls.

Strategy heuristics: Derives enemy composition profiles, suggested spells, core/tech items, lane plans, macro calls, and “golden rules” from curated hero augment metadata plus tag-driven analytics.

Live hero insights: When IDs are available, enriches your pick with hero details, ladder stats, counters, and partner synergies straight from the Stats API.

Readable UI: Tailwind-styled sections surface recommendations, composition dashboards, and situational tips once you select your hero and the opposing lineup.

Built-in diagnostics: Verbose console logging and startup self-tests flag normalization or heuristic regressions early so you can tweak safely.

Getting Started
Install dependencies:

npm install
Start the Vite dev server:

npm run dev
Build or preview production assets when you’re ready to deploy:

npm run build
npm run preview
```​:codex-file-citation[codex-file-citation]{line_range_start=6 line_range_end=17 path=package.json git_url="https://github.com/tonycelestino/mlbb-draft-coach/blob/main/package.json#L6-L17"}​
The app mounts on #root in index.html, which also pulls TailwindCSS from the CDN for rapid styling tweaks.

Data Flow & Fallbacks
Try https://mlbb-proxy.tonycelestino.workers.dev/stats for roster, hero detail, rankings, counters, and compatibility data.

Retry through permissive proxies (isomorphic-git, Jina AI HTTP/HTTPS mirrors, AllOrigins) to dodge CORS failures.

Fall back to https://mlbb-proxy.tonycelestino.workers.dev/wiki/heroes if the Stats API is unavailable.

Default to the bundled roster so the UI remains usable offline or when every remote source fails.

Each fetch path logs success or failure with its source so you can spot network issues from the browser console.

Strategic Heuristics
Extend or adjust hero-specific metadata in HERO_AUGMENT to control inferred roles, damage types, and tags without editing raw API payloads.

Composition profiling counts tag occurrences to flag poke, dive, sustain, CC, and damage-mix patterns that influence spell/item advice.

Suggestions recalc automatically whenever you change role selections or enemy heroes, ensuring guidance stays aligned with the current draft state.

UI Guide
Choose your role and hero (auto-complete from the loaded roster).

Pick allies/enemies with the multi-select panel (up to 4 allies, 5 enemies).

Review spell, item, lane, macro, and rule recommendations plus API-driven counters/synergies and composition indicators once enemies are set.

Self-test status, roster source, and attribution details appear in the footer so you always know which dataset powered the advice.

Debugging Tips
Open the browser console to watch [QuickDraft] logs for network attempts, roster outcomes, memoized strategy outputs, and self-test verdicts, which streamline troubleshooting during development.

Acknowledgements
Mobile Legends: Bang Bang © Moonton.

Live stats courtesy of ridwaanhall (BSD-3).

This project is fan-made and unaffiliated with Moonton.
