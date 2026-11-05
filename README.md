# Life Garden 🌱

A private personal life dashboard: **compound what matters, simplify everything else.** Built with Next.js, TypeScript, Tailwind, Lucide, Recharts, and local SQLite. No cloud account or paid API is needed.

![Daily growth board and 30-day tracker](docs/activity-board-preview.jpg)

_Preview uses a separate synthetic test dataset; new installations contain no completed history._

## Run on your Mac

Use Node.js 22.13+ (an active LTS version is recommended).

```sh
git clone https://github.com/pangshengwei/life-garden.git
cd life-garden
npm install
npm run dev
```

Open [Life Garden](http://127.0.0.1:3000). Keep the terminal running; press Control-C to stop. For the production build:

```sh
npm run build
npm start
```

Local mode binds to loopback and the data API accepts local, same-origin requests. For authenticated web and phone access, use the Railway deployment below.

## Deploy privately on Railway

The hosted app is a **single-owner garden**, protected by browser HTTP Basic authentication over HTTPS. The page and data API both require authentication. It does not provide separate accounts or per-user data isolation; only share credentials with someone who should have full access to your garden.

1. Run `npm run create-hosted-access` once. This creates `.deployment-access.json` with a cryptographically random 256-bit password and a salted scrypt hash. The file has owner-only permissions and is excluded from Git and Railway uploads. Store the password in your password manager. Scrypt uses a unique 16-byte salt, N=32768, r=8 and p=1. Existing deployments with generated random passwords can still use the legacy SHA-256 variable; scrypt takes precedence when configured.
2. Create a Railway service for this repository and attach a persistent volume at `/data`. Keep **one replica**. SQLite and the generated Markdown mirror live on this volume; the container filesystem is otherwise disposable. Enable volume backups in Railway and retain periodic JSON exports.
3. Generate an HTTPS Railway domain and set these server variables before deploying:

   | Variable | Value |
   | --- | --- |
   | `LIFE_GARDEN_HOSTED` | `1` |
   | `LIFE_GARDEN_DATA_DIR` | `/data` (must match the volume mount) |
   | `LIFE_GARDEN_USERNAME` | `username` from the private access file |
   | `LIFE_GARDEN_PASSWORD_SCRYPT` | `passwordScrypt` from the private access file |
   | `LIFE_GARDEN_ORIGIN` | exact HTTPS origin, with no trailing slash |
   | `PORT` | `3000` |

   Do not upload the plaintext password, `.env` files, or private data to GitHub. Do not prefix any credential variable with `NEXT_PUBLIC_`. Railway holds only the password hash; you may additionally seal the hash variable in its dashboard. No paid external API credentials are required.
4. Deploy. `railway.json` defines the build, startup and `/api/health` checks. Startup fails when required hosted settings or the Railway volume are missing. Remote access never falls back to local mode on Railway. The health endpoint returns only availability; it exposes no garden data.
5. Visit the HTTPS domain and enter your username and password in the browser's login prompt. The browser remembers Basic authentication for its session; close the browser or clear its site data to end access on a shared device. Changing the hash invalidates the old password after redeployment.

The first cloud deployment starts a **new garden**. To migrate existing records, export JSON from your old installation and restore it in the hosted app after signing in. Review the destination before importing sensitive data. The local and cloud databases are separate; changes do not merge automatically. The hosted Obsidian mirror is stored on Railway, not in your Mac's vault. Use Railway volume download tools if you want a copy of that Markdown locally.

See [Railway volumes](https://docs.railway.com/volumes) and [sealed variables](https://docs.railway.com/variables#sealed-variables) for persistence and secret settings.

## Your data

**SQLite is the source of truth.** The default database is `data/life-garden.sqlite`. All application changes use transactions. A versioned JSON document and relational tables update together, keeping backups, schedule history, and SQL exploration consistent.

Tables: `daily_notes`, `habits`, `habit_logs`, `goals`, `financial_snapshots`, `focus_sessions`, `goal_events`, and `app_state`. `habits.revisions_json` preserves historical schedule/target revisions. `habit_logs.excused` identifies recovery days. The complete document in `app_state` also holds settings and the in-progress focus timer.

The app saves shortly after changes. Wait for **Saved locally** before closing. It warns when closing with unsaved changes. If a second tab has changed the database, the stale tab cannot overwrite it: export unsaved edits and reload. A failed Obsidian mirror displays a warning while the SQLite save remains durable.

Use **Settings & backups → Export full backup** to download JSON, and **Restore a JSON backup** to validate and restore it. Export your current data before restoring another backup. Habit CSV export is also available. The JSON backup includes all application data; Obsidian-only personal annotations should be backed up with your vault.

`data/` and environment files are excluded from Git. SQLite and generated Markdown are local files, not encrypted files. If you back up the SQLite file directly, stop the app first or use SQLite's backup command; do not copy just the main file while WAL writes are active.

## Obsidian

Until you choose an existing vault, the app mirrors records into:

```text
data/obsidian/Life Garden/
  Life Garden.md
  Daily.base
  Goals.base
  Habit history.base
  Daily/
  Areas/
  Goals/
  Habits/
  Habit logs/
  Finance/
  Focus/
  Goal progress/
```

You can open `data/obsidian` as a vault to inspect this first. To use an existing vault, create `.env.local` in the project root:

```dotenv
OBSIDIAN_VAULT_PATH="/absolute/path/to/your/Obsidian vault"
```

Restart the app, then open the dashboard. Life Garden writes only to the vault's dedicated **Life Garden** subfolder. It does not require an Obsidian plugin. Open the `.base` files for tables, sorting and filters; the notes also contain YAML properties and internal links for Obsidian's graph. Habit log properties include date, category, actual value, target, completion and excused status.

This is a **one-way mirror**. Edit generated records and properties in Life Garden. Write extra thoughts below the generated block in each note's **Personal notes** section; that section is preserved. Files without the Life Garden marker are never overwritten. Generated fields above the marker are replaced on sync. Bases are only created when missing, so you may customise their views.

Restoring an older backup does not delete vault files. Records no longer in SQLite can remain in Obsidian; old mirror notes are retained intentionally to protect annotations. This means Obsidian may include historical files absent from the restored app. Changing vault paths leaves the old mirror intact.

Optionally relocate all private app data with `LIFE_GARDEN_DATA_DIR` (absolute path). See `.env.example`. Keep SQLite outside a vault that is synchronised live by a file-sync service; the Markdown mirror is the suitable synchronisation surface.

## What works

- Today: Singapore date/time, one priority and first step, plan tomorrow, quick journal, mood and energy, scheduled habits, and bedtime intentions.
- Focus: 25/60/90-minute sessions, pause/resume, focus mode, persisted deadlines, and outcome notes on completion or early finish.
- Habits: create, rename/edit, remove and restore directly from the daily list; yes/no, counts, minutes and numeric targets; editable weekdays; pause; weekly history; historical corrections; excused recovery days. Choose the effective date when creating or editing a habit. Past-date edits default to **Only this day**; **From this date onward** applies until the next saved change. Later saved revisions are preserved. Historical removal affects that date only. Current removal is reversible through **Removed habits**.
- Goals: annual/quarterly/monthly/weekly horizons, qualitative 0/1 outcomes, numeric progress, dependencies, due dates, status, editing and archive/restore.
- Garden: six life areas, related goals/habits, outcome progress, activity counts, XP, levels and an original animated plant.
- Journal: calendar browsing, morning notes, evening prompts, editable weekly reflections, tomorrow planning and actual overnight sleep records on the wake-up date.
- Finance: dated manual snapshots, liquid wealth with/without SRS, restricted SRS, net worth, optional securities/property/contribution amounts, allocation, FIRE progress and growth charts after two snapshots.
- Insights: a GitHub-style daily board, rolling 30-day average daily habit completion score, explained weekly consistency, completion trends, balanced activity counts, and earned badges. There are no invented historical habit completions.
- Responsive layout, light/dark themes, keyboard labels, native modal focus containment and reduced-motion support.

Fresh clones start with generic aspirational goals, configurable habits, and no financial snapshots or completed activity. Your personal balances, employer/project context, name, journal notes and exported backups belong in the ignored local data directory, not the published source. Existing local databases keep their personal goals and snapshots when the app is upgraded. Financial goals and snapshots are edited independently so an old snapshot cannot silently overwrite a newer goal update.

## Correct a past day or find a missing habit

Tracking begins on **1 November 2026**. An existing database with a later tracking start is migrated once when the app next starts, so 1–3 November can be selected in the weekly grid and historical habit editor. Habits present at the original tracking start inherit their initial plan for the earlier days; later revisions, logs, notes and goals are preserved. Habits introduced after the original start retain their own dates and can be included explicitly with **Add to this day**. No historical completions are created. Missing scheduled habits on the newly tracked days count as unfinished until corrected, which can change the rolling score.

Click a past or current square in the weekly habit calendar to open that specific habit’s logging controls. A **+** means it is not scheduled on that date; the dialog explains why and offers **Add to this day** before logging. Future dates and dates before tracking began are locked and labelled. You can also select a date using the calendar header. Row labels and pencil controls use that date’s saved settings. You can edit historical names, targets and schedules; the editor shows an effective date and whether the change is for one day or from that date onward. **Use today’s name, target and schedule** copies the current settings into a historical correction without silently applying them to other days.

The daily list includes scheduled, unpaused habits that have already started on the selected date. **Show other habits** jumps to the additional habits beneath the scheduled list. **Not scheduled on this day** lists these other habits and explains whether they are on another weekday, paused, or not yet started. **Add to this day** explicitly uses the current habit settings for that one date and preserves the normal recurring plan. No completion is invented; log the actual result afterward.

A Tuesday habit starting on a Wednesday does not automatically backfill the previous Tuesday. Use an earlier start date or **Add to this day** when that is what you intend.

## Scores and interpretation

### Daily growth board

Habits and Insights show a rolling 365-day contribution calendar. Each square opens that date's scheduled habits, completed and excused targets, goal progress, focus outcomes, intention and journal notes. Arrow keys move between squares; Enter/Space opens a day. On mobile, scroll the board horizontally; it opens at the most recent days.

Colour intensity counts **completed scheduled habits + goals newly marked achieved on that date**: 0, 1, 2–3, 4–6, or 7+ completions. Empty tracked days and dashed untracked days are visually distinct. Goal edits record dated events from this version onward. Older achieved goals are not assigned invented dates. Multiple updates to one goal on one day count at most once; a same-day correction away from achieved removes that achievement from the square.

### Rolling 30-day daily habit score

The window is today and the previous 29 Singapore dates, counting only **2 November 2026 onward** and no earlier than the garden’s tracking start. Each daily score is `completed scheduled habits / scheduled, non-excused habits × 100`. A habit counts as completed when it meets its full target; weekly habits count only on their scheduled dates.

The **Past 30D habit score** is the arithmetic mean of those daily scores, with every eligible day weighted equally. A day with 1/2 habits and a day with 1/1 habits average to 75%, rather than pooling them into 2/3. The calculation uses exact daily fractions and rounds only the final percentage to one decimal place.

Dates with no scheduled habits and fully excused or paused days are excluded. A scheduled day with no completed habits contributes 0%, even if it has no saved logs. Today is included and can still improve. Checking or unchecking habits and changing historical targets, schedules or excused status recalculates the average immediately from the current garden data. Changes persist through the normal SQLite save flow. An empty denominator displays a dash. The UI shows how many days contribute; 1 November remains editable but does not contribute to this score. Goal achievements affect square colour but not this habit-only percentage.

### Weekly consistency and XP

Weekly consistency = completed scheduled habits / scheduled habits × 100, from Monday through today and no earlier than tracking began. Future, paused and excused habits are excluded. Today's unfinished habits are opportunities, not failures.

XP: scheduled habit completion +10; evening reflection with a win and lesson +15; weekly reflection +20; first focus session of at least one minute on a date +20; achieved goal +30. Every 100 XP adds a level. Corrections and undone completions recalculate XP; missing a day does not deduct XP. New installations start at zero XP.

Hours and completions measure activity, not impact. Record evidence in your goal and focus outcome notes. Sleep/energy comparisons remain a future enhancement; this version displays honest data counts rather than inferred relationships. Financial balance changes minus recorded contributions are labelled residual changes, not pure investment gains.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

Domain/storage tests use temporary databases and do not mutate your garden. See `docs/VERIFICATION.md` for browser checks and current limits.

## Architecture and next steps

`src/lib/model.ts` and `activity.ts` contain domain rules; `database.ts` owns SQLite transactions and its relational projection; `obsidian.ts` writes the Markdown mirror; `validation.ts` validates incoming data and restores; `use-garden.ts` serialises browser saves with revision protection. React views live in `src/components`; the local server boundary is `src/app/api/state/route.ts`.

A later Supabase/Postgres adapter can replace this server boundary without rewriting the views or domain rules. Next milestones: authenticated personal/mobile access, explicit two-way Obsidian conflict resolution if desired, richer sleep/energy outcome comparisons, and more custom achievement rules. This MVP does not create reminders or change your existing ChatGPT accountability schedule.
