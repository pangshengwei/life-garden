# Verification · 3 November 2026

The app was built and exercised on this Mac using a separate QA SQLite directory in `/tmp`. Test actions did not populate the project's actual habit/journal activity.

## Automated checks

- `npm run typecheck`: TypeScript validation.
- `npm test`: thirteen domain/storage tests. These cover Singapore date rollover, empty activity seeds, recovery-day scoring, historical habit schedules, numeric completion thresholds and capped focus XP, invalid backup rejection, durable SQLite reopen, relational table projections, concurrent revision rejection, Obsidian habit properties/annotation preservation, safe SQLite commits when the mirror fails, rolling 30-day denominators and thresholds, corrected goal-event aggregation, and persisted dated goal history.
- `npm run build`: optimized Next.js build, including the local route handler. No build warnings after the explicit dynamic-path tracing opt-out.

## Browser checks

Exercised through the in-app Chromium browser against an isolated production server:

- Planned tomorrow's priority and first concrete step; verified these persisted in SQLite.
- Completed a habit, recorded mood and quick journal notes, refreshed, and verified the saved values.
- Started and paused a focus session, refreshed, finished early with a written result, and verified the saved session.
- Paused a weekly habit and created a goal with achieved progress.
- Wrote evening wins and a lesson.
- Recorded actual sleep from 2 Nov, 22:45 to 3 Nov, 06:30; verified the 7.8-hour display and completion under the wake-up date.
- Added a dated financial snapshot; verified stored amounts and the appearance of the two-point chart without console errors.
- Restored a validated JSON file through the native file chooser, exported the resulting garden, and compared the browser-downloaded JSON to the restored input: identical.
- Checked navigation and layouts at desktop and mobile breakpoints, including a narrow 325 CSS-pixel viewport. The habit calendar scrolls within its own container; its mobile hint explains that gesture.
- Checked dark mode, modal forms, and mobile menu behavior.

The first sleep-form check revealed native datetime input values could reset during dashboard clock rerenders. Sleep inputs now use native form values on submission, and the overnight-save check passes. The first automated download observation timed out; the subsequent native download and restore check completed and its contents were verified.

## Daily board and 30-day tracker

The new board was checked against a separate synthetic 60-day fixture stored outside the repository. Colour levels, keyboard-accessible date buttons and the day-detail modal were inspected. The modal showed the exact scheduled habits and a dated goal achievement. Achieving another goal through the UI immediately added it to that day's details. Completing the remaining scheduled habits changed the rolling score from 3/30 (10%) to 4/30 (13%). Goal achievements did not affect that habit-only percentage.

The board and day-detail modal also worked at 390 CSS pixels with no document-level horizontal overflow; the calendar itself scrolls horizontally. The README preview uses only this synthetic fixture. Fresh public installations have empty activity and financial history; the existing private local database is retained.

## Boundaries

- No real external Obsidian vault path has been provided. The generated mirror is staged in `data/obsidian/Life Garden`; actual Obsidian desktop/Bases rendering has not been tested. YAML, links, Bases files, and annotation preservation were inspected/tested on disk.
- One-way SQLite-to-Markdown mirroring only. Existing vault notes are retained when a backup is restored; stale mirror records may therefore remain.
- Native Safari, iOS Safari, phone network access, and cross-device synchronization were not tested. The server deliberately accepts local loopback access only.
- Sleep/energy causal or statistical insights and additional configurable achievements remain future work. The current app shows honest empty states and recorded counts.
- Focus deadlines are timestamp-based and survive refresh; a full uninterrupted 90-minute session was not waited through during verification. Early completion, pause/resume, and saved outcomes were exercised.
