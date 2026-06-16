# Gautam's Apps

A local-first operating ledger for tracking initiative-specific time, expenses, funds, invoices, approvals, access profiles, and monthly expense reporting across multiple apps.

## Current App

This repository contains the static Gautam's Apps prototype:

- `index.html` - app shell and forms
- `styles.css` - application styling
- `app.js` - local state, imports, reporting, access filtering, and Supabase sync
- `useful-apps-supabase-schema.sql` - Supabase table and policy setup

## Run Locally

From the repository root:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/
```

## Production

Live app: `https://gautamsapps.netlify.app/`

Netlify should publish the repository root with no build command. The included `netlify.toml` keeps `index.html` and `app.js` revalidated so production picks up fixes quickly.

## Supabase

Project: Useful apps  
Project ID: `pmyqsieamfohrywdpora`  
Project URL: `https://pmyqsieamfohrywdpora.supabase.co`

Run `useful-apps-supabase-schema.sql` in the Supabase SQL Editor, then paste the project anon key into Settings inside the app and enable cloud sync.

## Notes

The current app uses browser local storage as an offline cache and optional Supabase sync for persistence. UI-level access filtering is included for local testing; production authorization should be enforced with Supabase Auth and row-level security.
