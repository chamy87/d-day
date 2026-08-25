# D-Day — UX improvement brief (for Claude Code)

Grounded in the shipped code at `src/components/*.tsx` (commit c5a3128). Visual reference: `proposals/draft-room-v2/index.html` in the design-system project — an interactive mock of items 1–4. Keep all existing tokens/components; new pieces below reuse them.

## 1. First-run team picker (draft room + dashboard)
Problem: `myUserId` is chosen via a small header `<Select>`; the "Pick your team" Toast is a workaround. Users miss it and see a rail with no roster/suggestions.
Fix: when no stored team pref exists, show a modal overlay on entry — "Which team is yours?" — a grid of team cards (team name, avatar initial, draft slot). One tap, stored via existing `saveTeamPref`. Keep the header Select as the change-later affordance, moved into an overflow position. Skippable ("Just browsing") for spectators.

## 2. Snake pick strip (draft room)
Problem: pick order lives only as text in the on-the-clock pill ("3.07 · Team X · you're up in 2").
Fix: a horizontal strip under the header showing the next ~14 picks as chips: team initials + pick label, current pick = amber pulsing chip, MY picks = amber-outlined chips, round boundaries marked "R4 ⇄" (snake direction). Auto-scrolls as picks come in (reuse the 3s poll). This makes "when am I up" ambient instead of read.

## 3. Queue (draft room rail, top position)
Problem: no way to shortlist players; the board resorts every 3s and targets get lost.
Fix: star `IconButton` on each `PlayerRow` (trailing slot already exists in the component API). Starred players go to a "MY QUEUE" card at the top of the rail: ordered, removable, drafted ones auto-strike and fade (don't remove — seeing a sniped target matters). Persist per league in the session/localStorage like team pref. Suggested-pick card gets a one-tap "☆ Queue" action.

## 4. Expandable player rows (draft room board)
Problem: rows are inert; no way to sanity-check a pick without leaving the app.
Fix: tap a row → inline expansion (accordion, one open at a time): projected pts (league scoring), VBD, ADP + delta, FantasyCalc value, tier, bye, injury detail, latest news headline for that player (already cached server-side in `news_cache`). Two actions: ☆ Queue, ✕ collapse. Keyboard: ↑↓ move, Enter expand, Q queue.

## 5. Header decongestion (both screens)
Problem: draft-room and dashboard headers carry identity + tags + status + nav + 1–2 Selects and wrap unpredictably; mobile is worst.
Fix: two-row header on <900px — row 1: wordmark, league name, status; row 2: controls. Desktop: move Week + team Selects into the content area (dashboard: week select belongs next to the tab content title, not global chrome). Nav links ("Dashboard →") become a persistent segmented control: BOARD | DASHBOARD.

## 6. Mobile: bottom tab bar (draft room)
Problem: mobile stacks board (58dvh) + rail in one scroll; the roster/suggestions are below the fold during a live draft.
Fix: bottom tab bar — BOARD · QUEUE · ROSTER · PICKS — each a full-height pane; on-the-clock pill stays fixed top. 44px+ targets throughout (already in tokens: `--control-h-lg`).

## 7. Trade builder polish (advisor tab)
Problem: raw `<input type="checkbox">` and raw `<select>` inside the roster list — off-system.
Fix: selectable rows (tap toggles, amber tint = selected, reuse PlayerRow-style rows), recipient picker uses the system `Select`. Add a value-balance bar per side (mono numbers, `--value`/`--reach` fill) so fairness reads at a glance before evaluating.

## 8. Small fixes
- Recent-picks ticker: newest pick should flash in (one-time `dday-pulse`-style highlight) so board removals are explainable.
- "Nothing left under this filter" empty state: add a ghost Button "Clear filter".
- News tab name-matching (`t.includes(lastName)`) misfires on common surnames — match on player id when the feed item carries `player_ids[]` (schema already has it), fall back to full-name match only.
- Dashboard week Select allows future weeks with no data — cap at current NFL week from `/state/nfl`.

Priority order: 1, 3, 2, 6, 4, 5, 7, 8.
