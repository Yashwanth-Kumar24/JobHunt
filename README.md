# JobHunt Dashboard

A personal job-hunting dashboard that surfaces fresh postings from 30+ companies, lets you track every application through a full pipeline, and keeps all your data in your browser — no account needed.

---

## What it does

| Feature | Details |
|---|---|
| **Latest Jobs** | Day-strip UI — click any day to filter the table and stats instantly |
| **30-day window** | Full month of postings, no row-cap truncation (batch pagination against Supabase) |
| **Live stats bar** | Updates with every filter: jobs in range, today's count, companies, tracked applications |
| **Search** | Searches company name, title, job ID, and location simultaneously |
| **Location filter** | Dropdown built from actual job locations — no empty results |
| **Status pipeline** | 5 stages: Applied → Screening → Interview → Offer → Rejected, stored in localStorage |
| **Notes** | Per-job inline notes, saved instantly to localStorage |
| **NEW badge** | Highlights jobs posted since your last visit |
| **Freshness colors** | Posted column: green = today, blue = yesterday, amber = 2–3 days, grey = older |
| **Application Tracker** | Pipeline summary cards, filter by stage, search, remove |
| **Companies page** | All companies sorted by recent job count, searchable |
| **Company detail** | Full job history per company, location filter, status, notes, paginated |
| **Export CSV** | Downloads all tracked jobs with status, notes, and posting links |
| **Dark mode** | System-aware default, manual toggle, FOUC-free (inline script before paint) |
| **Compact view** | Toggle between comfortable and dense table row heights |
| **Daily quote** | A fresh motivating quote on every page load |

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, `"use client"` components) |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL, read-only via PostgREST) |
| State | React hooks + localStorage |
| Dark mode | Class-based (`dark` on `<html>`), `@custom-variant` in Tailwind v4 |

---

## Project structure

```
app/
  layout.tsx              Root layout — FOUC-prevention script, Navbar
  globals.css             Tailwind import, dark mode variant, native select fix
  page.tsx                Redirects / → /latest
  latest/
    page.tsx              Main dashboard — day strip, two-phase loading, table
  companies/
    page.tsx              Company grid with recent job count badges
    [id]/
      page.tsx            Company detail — full job history, paginated
  applied/
    page.tsx              Application tracker — pipeline cards, status filter
  components/
    Navbar.tsx            Brand, nav links, today count badge, ThemeToggle
    ThemeToggle.tsx       Dark/light toggle, persisted to localStorage

lib/
  supabase.ts             Supabase client (anon key, read-only)
  useJobTracker.ts        Core hook — statuses + notes in localStorage
  useLastVisit.ts         Reads previous visit timestamp for NEW badge logic
```

---

## Data loading architecture

The dashboard uses a **two-phase strategy** to handle large windows (30 days = 3000+ jobs) without hitting PostgREST's server-side row cap:

```
Phase 1 — Metadata (fires on range change)
  SELECT id, title, posted_at, first_seen_at, job_id, locations, company_id
  Paginated in batches of 1000 until exhausted.
  → Builds: day-strip counts, stats bar, search/filter/sort index

Phase 2 — URLs (fires on page or filter change)
  SELECT id, posting_url WHERE id IN [current page's 20 IDs]
  Fetches exactly pageSize records — no pagination loop.
  → Populates: "View ↗" links in the table
```

Benefits:
- Day strip always shows accurate counts across the full range — no truncation
- Page changes fetch only 20 records, not thousands
- All filtering (date, search, status, location) runs client-side on in-memory metadata — instant

---

## Local storage schema

| Key | Type | Purpose |
|---|---|---|
| `jobhunt_status` | `Record<jobId, JobStatus>` | Pipeline stage per job |
| `jobhunt_notes` | `Record<jobId, string>` | Notes per job |
| `jobhunt_last_visit` | ISO timestamp | Computes NEW badges |
| `jobhunt_theme` | `"dark" \| "light"` | Theme preference |

No user accounts. No server writes. All tracking data lives in the browser.

---

## Getting started

### Prerequisites

- Node.js 18+
- A Supabase project with `jobs` and `companies` tables (see schema below)

### Environment

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to `/latest`.

### Build for production

```bash
npm run build
npm start
```

---

## Supabase schema

```sql
create table companies (
  id   uuid primary key default gen_random_uuid(),
  name text unique not null
);

create table jobs (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid references companies(id),
  external_job_id text not null,
  job_id          text,
  title           text,
  posting_url     text,
  posted_at       timestamptz,
  locations       jsonb,
  first_seen_at   timestamptz,
  last_seen_at    timestamptz,
  unique (company_id, external_job_id)
);

-- Recommended indexes
create index on jobs (posted_at desc);
create index on jobs (company_id);
```

---

## Known limitations

- **Anon key is public** — ensure Supabase RLS policies allow only `SELECT` from the browser. The dashboard never writes to the database.
- **Native `<select>` dark mode** — browser ignores Tailwind dark variants on form controls. Handled with explicit `.dark select` CSS rules in `globals.css`.
- **localStorage only** — tracked jobs and notes are tied to the browser. Clearing site data removes them. Export CSV before switching machines.

---

## Backend

The scraper (separate repo) is a Python pipeline that runs on GitHub Actions and writes fresh jobs into Supabase. It covers 30+ companies including Amazon, Microsoft, Apple, NVIDIA, Salesforce, Goldman Sachs, Cisco, Oracle, Snowflake, Uber, Stripe, Databricks, Airbnb, Lyft, Robinhood, Datadog, and more.

This dashboard is read-only — it queries Supabase directly with the public anon key and never touches the backend.
