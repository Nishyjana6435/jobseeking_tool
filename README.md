
<img width="3456" height="2234" alt="3AF7CCCB-F738-412C-A0BB-8CF4664418F5" src="https://github.com/user-attachments/assets/9fbac926-737a-4f07-bd3c-a7efc386fb33" />

# job-apply-tool

Next.js dashboard plus CLI that reads your CV, pulls jobs from free public job boards, scores each one against your actual skills with Claude, generates ready-to-paste application materials (cover letter, tailored CV bullets, screening-question answers), emails recruiters with one click, and tracks every application through to offer.

Data lives in an Upstash Redis database when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set (required for the hosted dashboard on Vercel), otherwise in local JSON files under `data/`. The CLI on your machine and the hosted dashboard share the same database.

## Setup

```bash
npm install
npm run dev                 # http://localhost:3000, then add keys on the Settings page
```

Settings page → API key, database (Upstash Redis REST URL + token) and email (SMTP) are saved to `.env` locally. If you already have local data, copy it into the database once with `node src/cli.js migrate`.

### Hosting the dashboard on Vercel

The dashboard (jobs, scores, tracker, materials, tailored CVs, one-click recruiter emails, settings) runs on Vercel. Set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ANTHROPIC_API_KEY` and the `SMTP_*` variables in the project's Environment Variables. Long-running work (searching boards, bulk scoring, LinkedIn Easy Apply with a real Chrome) runs from your machine with the CLI and writes to the same database.

Upload your CV on the Profile page as PDF, Word (.docx) or text (or `cp your-cv.pdf ./cv.pdf && node src/cli.js profile`). Tune target titles, search terms, sources and location preferences on the Settings page.

## Web UI

- **Dashboard** stat tiles, one-click Search / Score / Prepare with live logs, top matches, active applications.
- **Jobs** filterable table (score, verdict, status, source, location ok, text search).
- **Job page** description, Claude match analysis, generated cover letter / email / CV bullets / screening answers with copy buttons, status dropdown, notes, history.
- **Tailored CV** (`/jobs/<id>/cv`) a complete CV rewritten for that job from your profile facts only: new headline and summary, skill groups reordered, bullets reworked to mirror the posting's terminology, with change notes and the job keywords now covered. Edit the text in place, download as Word (.docx), or print to PDF. Steer regeneration with a one-line instruction.
- **Fill sheet** every field an application form asks for, from your CV, with copy buttons.
- **Tracker** kanban: saved, prepared, applied, interview, offer, rejected.
- **Profile** structured view of what was extracted from your CV; re-upload to refresh.
- **Recruiter email** when a posting contains a contact address, the job page shows it with one button that writes the cover letter (if not done yet), attaches your tailored CV (or your uploaded base CV), sends the email from your own mailbox over SMTP, and marks the job as applied. Review or edit the draft first if you want. The jobs list has a `has recruiter email` filter.
- **Settings** Anthropic API key, database, SMTP email account, search/matching config, and learned form answers. Locally these are written to `.env`; on Vercel they come from the project's environment variables.

Locally, long tasks (search, scoring, preparing) run in the background inside the Next server and stream their logs to the dashboard; one task runs at a time. On Vercel those buttons are replaced by the CLI commands to run on your machine.

## CLI (same data, same engine)

```bash
node src/cli.js run                    # search all boards + score new jobs
node src/cli.js list --min 70          # ranked matches
node src/cli.js show <jobId>           # read a posting
node src/cli.js apply --top 5          # generate materials for the 5 best unprepared matches and open each apply page
node src/cli.js apply <jobId>          # for one specific job
node src/cli.js status                 # tracker
node src/cli.js mark <jobId> applied   # after you submit (also: interview, rejected, offer)
```

`node src/cli.js run --prepare --top 5` does search, match, and material generation in one command.

Generated materials land in `applications/<company>--<title>/application.md` with the cover letter, application email, tailored CV summary and bullets, keywords to add, screening answers, and a LinkedIn note.

## LinkedIn Easy Apply automation

For LinkedIn postings with the Easy Apply button, the tool can fill the application in a Chrome window using your own saved LinkedIn login.

```bash
node src/cli.js linkedin-login              # once: log in inside the dedicated Chrome profile (data/browser-profile)
node src/cli.js easy-apply --top 3 --min 75 # review mode: fills every step, stops at Submit for you to check
node src/cli.js easy-apply <jobId> --submit # presses Submit too
```

The same controls are on the dashboard and each LinkedIn job page. How it answers questions: prefilled LinkedIn fields are left alone; contact fields come from your profile; standing answers (notice period, salary, work authorisation, relocation) come from `applicationAnswers` in config; anything else is answered by Claude from your profile and saved to `data/answers.json` for reuse and for you to correct on the Settings page. The tailored CV for that job is uploaded if one exists, otherwise your base CV. Postings that use an external site are opened for you instead. Screenshots of any failure land in the job's applications folder.

Caveats: LinkedIn's user agreement prohibits automation, and fast bursts can get an account restricted. Keep `easyApplyMaxPerRun` small, prefer review mode, and space runs out. LinkedIn changes its markup, so if a step stops matching, the run stops with a screenshot rather than guessing.

## What it does not do

It does not auto-submit on other job sites. The tool prepares everything, gives you a fill sheet and a tailored CV, and opens the apply page.

## Sources

- **LinkedIn** public job search scoped to `country` in config (default Sri Lanka), including each posting's full description. Unauthenticated and rate-limited politely; if LinkedIn returns 429 the adapter stops for that run.
- **topjobs.lk** IT-Software functional area. Adverts are usually images, so only title, company, location and dates are available; the scorer is told the description is thin.
- **Remotive, Jobicy, Himalayas, Remote OK, We Work Remotely, Working Nomads, Arbeitnow** free public APIs and RSS feeds for remote roles. Jobs located in Sri Lanka get the biggest prefilter boost, then worldwide/APAC remote roles.

Scoring skips postings whose location matches `restrictedLocationPatterns` in config (US-only, Europe-only, and so on) unless they also say worldwide, APAC, or Sri Lanka. Set `scoreOnlyEligibleLocations` to false to score everything.

All boards ask you to link back to the original posting, which the tool does by linking to their URL.

## Layout

- `app/` Next.js 16 App Router UI (server components read the JSON store directly; server actions write to it)
- `app/api/run/route.js` starts and polls background tasks (`src/lib/runner.js`)
- `src/profile.js` CV PDF to structured profile via Claude structured outputs
- `src/sources/index.js` job-board adapters, normalised to one shape
- `src/search.js` fetch, dedupe, keyword prefilter against CV keywords
- `src/match.js` Claude scoring in batches, profile cached via prompt caching
- `src/apply.js` application material generation and tracker
- `src/cv.js` tailored CV generation (facts locked from profile); `src/lib/docx.js` Word export
- `src/cli.js` commands
