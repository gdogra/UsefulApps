# Gautam's Apps

A local-first operating ledger for tracking initiative-specific time, expenses, funds, invoices, approvals, access profiles, and monthly expense reporting across multiple apps.

## Current App

This repository contains the static Gautam's Apps prototype:

- `index.html` - app shell and forms
- `styles.css` - application styling
- `app.js` - local state, imports, reporting, access filtering, and Supabase sync
- `gautams-apps-production-schema.sql` - production Supabase tables and policies
- `gautams-apps-supabase-schema.sql` - legacy single-row JSON sync setup

Expense entries can include an invoice, quote, purchase order, receipt, or other vendor document. Files are currently stored in the `expense_documents` table as JSON/base64 payloads and capped at 2 MB each; moving larger documents to Supabase Storage is the next production step.

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

Project: Gautam's Apps  
Project ID: `pmyqsieamfohrywdpora`  
Project URL: `https://pmyqsieamfohrywdpora.supabase.co`

Run `gautams-apps-production-schema.sql` in the Supabase SQL Editor, then use Settings inside the app to enable cloud sync. The app now reads and writes table-backed records: `initiatives`, `expenses`, `expense_documents`, `time_entries`, `income_entries`, `fund_entries`, `audit_events`, `app_users`, and `app_settings`.

## Notes

The current app uses browser local storage as an offline cache. Supabase is the production record source once the table schema is installed. UI-level access filtering is included for local testing; production authorization should be enforced with Supabase Auth and row-level security.
