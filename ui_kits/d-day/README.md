# D-Day UI kit

Interactive recreation of the three core surfaces (fake data, real components from `components/`):
- `Landing.jsx` — league-ID entry → detected-league summary → route to draft
- `DraftRoom.jsx` — best-available board with tier breaks, position filter, hide-drafted, on-the-clock header, suggested pick, my-roster rail, recent-picks ticker (click a row to "draft" that player)
- `Dashboard.jsx` — START/SIT · MATCHUP · WAIVERS · NEWS tabs

Open `index.html` to click through the flow. No repo UI existed at build time (chamy87/d-day was empty) — these follow `guidelines/architecture.md` and the brief, not imported code.
