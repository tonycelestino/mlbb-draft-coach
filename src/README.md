# MLBB Quick Draft Coach
MLBB Quick Draft Coach is a Vite + React single-page assistant that helps Mobile Legends: Bang Bang players navigate hero drafts with resilient data loading, strategy heuristics, and actionable in-game checklists.

## Key Features
- **Robust data sourcing:** Attempts the ridwaanhall Stats API directly, then cascades across multiple open proxies before falling back to the MLBB Wiki or a bundled roster so the app keeps working even when CORS blocks direct calls.
- **Strategy heuristics:** Derives enemy composition profiles, suggested spells, core/tech items, lane plans, macro calls, and “golden rules” from curated hero augment metadata plus tag-driven analytics.
- **Live hero insights:** When IDs are available, enriches your pick with hero details, ladder stats, counters, and partner synergies straight from the Stats API.
- **Readable UI:** Tailwind-styled sections surface recommendations, composition dashboards, and situational tips once you select your hero and the opposing lineup.
- **Built-in diagnostics:** Verbose console logging and startup self-tests flag normalization or heuristic regressions early so you can tweak safely.

## Getting Started
1. Install dependencies:
   ```bash
   npm install
