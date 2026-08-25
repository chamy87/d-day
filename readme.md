# D-Day Fantasy Football — Design System

D-Day is a no-login fantasy football draft assistant and in-season manager built on the Sleeper API. Users paste a Sleeper league ID; the app reads that league's public settings (scoring, roster slots, superflex, TE-premium) and adapts every ranking and recommendation to them. The hero surface is the **Live Draft Room** — a dark, high-contrast, second-screen experience with a league-tuned VBD best-available board, tier breaks, pick timer, roster needs, and suggested picks. In-season it becomes a dashboard: start/sit, matchups, waiver targets, and a filtered news feed.

**Source repo:** https://github.com/chamy87/d-day — attached but **empty at build time** (no commits), so this system was authored from the product brief, not imported code. Explore the repo later as it fills in; sync this project against it when real UI lands.

Data partners the product credits in-UI: Sleeper, nflverse, FantasyFootballCalculator, FantasyCalc, Boris Chen.

## CONTENT FUNDAMENTALS
- **Voice:** terse, tactical, second person. The app talks like a sharp co-drafter on the clock: "You're up in 3 picks." "Only 2 RBs left in this tier." Never hype, never filler.
- **Casing:** Sentence case for body and buttons ("Enter league", "Add to queue"). UPPERCASE with letter-spacing reserved for structural labels: position badges, tier breaks, panel headers (MY ROSTER, ON THE CLOCK).
- **Numbers do the talking:** stats, VBD, ADP deltas are set in mono (`--font-mono`) and lead the sentence. "+14.2 VBD · ADP 38 (value)".
- **Rationales are one line, always:** every suggestion carries a single-clause "why" — "Best VBD available and your last RB2 window."
- **No emoji.** Arrows and unicode glyphs (▲ ▼ ·) carry direction and separation.
- **Honest degradation copy:** when a fragile source fails, say "Projections degraded — showing VBD from cached data", never a raw error.
- **Attribution is copy, not chrome:** a quiet footer line — "Data: Sleeper · nflverse · FFC · FantasyCalc · Boris Chen".

## VISUAL FOUNDATIONS
- **Dark-only.** Page `--bg-0 #0B0E11` → panels `#12161B` → cards `#1A2027` → raised `#232B34`. No light theme; the draft room is a war room.
- **Color:** one brand accent — amber `--accent #FFB43D`, the "on the clock" color. Green `--value` = value/positive delta, red `--reach` = reach/injury/negative. Position identity colors (`--pos-qb` … `--pos-def`) appear only in badges and thin rails, never as fills. Tier scale `--tier-1..6` hot→cold for tier-break rules and chips.
- **Type:** Archivo variable. Display = Archivo at `font-stretch:125%` (expanded), weight 850, tight leading, often uppercase. Body = Archivo normal width, weight 440. All numerals/timers/stat columns = JetBrains Mono. (Both are Google-Fonts substitutions — no brand font files were provided.)
- **Backgrounds:** flat solids only. No gradients, no textures, no imagery. Depth comes from surface steps + 1px borders (`--line-1`) + soft large shadows (`--shadow-card`). Bottom scrims (`--scrim-bottom`) protect fixed tickers.
- **Corners:** 6/10/14px (`--radius-sm/md/lg`); pills for badges and timers. Cards = `--surface-card`, 1px `--border-card`, `--radius-lg`, `--shadow-card`.
- **Motion:** fast and snappy — 120–220ms, `--ease-snap`. Draft events slide/fade in; drafted rows collapse out. The on-the-clock element breathes with `dday-pulse`. Skeleton shimmer (`.dday-skeleton`) for every loading state; no full-page spinners.
- **Hover:** surface lightens one step (card → raised) or accent brightens (`--accent-hover`); press darkens (`--accent-press`) with a 1px translate. Focus = amber double ring (`--focus-ring`).
- **Layout:** dense, columnar, second-screen friendly. Draft room = board (fluid) + right rail (roster/suggestions, 320px) + fixed bottom ticker. Data rows are 44px+ touch targets on mobile.
- **Transparency/blur:** only for overlays (dim scrim) and the sticky ticker (slight blur ok); never on content cards.

## ICONOGRAPHY
- No icon set existed in the source (empty repo). **Substitution: [Lucide](https://lucide.dev) via CDN** — 1.5px stroke, matches the utilitarian tone. Load `lucide` UMD or copy individual SVGs. Flagged for replacement if the product adopts its own set.
- Unicode glyphs are first-class: ▲▼ deltas, · separators, ● injury dots. No emoji, ever.
- **No logo exists.** Wordmark = "D-DAY" set in display type (expanded, 850, uppercase, amber "D-" optional). Do not draw a mark. Noted absence — ask the brand owner for real assets.

## Index
- `styles.css` → `tokens/` (colors, typography, spacing, effects, fonts)
- `guidelines/` — specimen cards (Colors, Type, Spacing groups) + `architecture.md` (IA, Supabase schema, Next.js routes, VBD function spec)
- `components/core/` — Button, IconButton, Input, Select, Switch, Tabs
- `components/display/` — Card, PositionBadge, Tag, TierBreak, StatDelta, PlayerRow
- `components/feedback/` — Toast, Tooltip, Skeleton
- `ui_kits/d-day/` — Landing, Draft Room, In-Season Dashboard (interactive `index.html`)
- `thumbnail.html`, `SKILL.md`, `github.md`

### Intentional additions
No source defined components, so a standard set was authored, plus product-specific primitives: **PositionBadge** (position identity is core to every list), **TierBreak** (visual tier separators are a hero pattern), **StatDelta** (value-vs-ADP indicator), **PlayerRow** (the draft board's atomic unit).
