# HERALD Intelligence Dashboard

PWA dashboard for the HERALD VC Secondaries Newsletter Intelligence System.

Built with Next.js 14 App Router, Supabase real-time, and a luxury editorial design system.

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in env vars
npm run dev
```

## Deploy

Railway: connect this repo, set env vars, deploy. Health check at `/api/health`.

Login password is set via `DASHBOARD_PASSWORD` env var.
