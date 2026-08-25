# GharKhata

An offline attendance and salary tracker for household help — maid, cook,
driver, milkman, nanny, or anyone else you pay by the day or the month.
Think *Khatabook, but for house help.*

Everything runs on the device. There is no backend, no login, and no
account — the app never makes a network call for its own data.

## Features

- **Attendance** — mark Present / Half day / Absent for each worker in one
  tap from the Home screen; back-fill or correct any past day from the
  Calendar.
- **Salary, calculated automatically** — monthly, daily, or per-unit pay
  (e.g. ₹/litre for a milkman), pro-rated automatically for a worker hired
  or let go mid-month. Unmarked days are never silently paid for.
- **Advances and running balance** — record an advance in one tap; every
  worker's card shows a running balance due that carries forward month to
  month until you record a payment against it. Full history with delete
  (no partial edits — delete and re-add covers corrections).
- **Payslips** — share a formatted WhatsApp message or a branded PDF slip
  straight from the Salary screen.
- **Backup & restore** — export the entire database to a JSON file (via the
  system share sheet) and restore it on a new phone or after a reinstall.
- **Dark/light theme**, **English/Hindi**, and a 2-worker free tier with the
  premium gates already wired (no billing turned on yet).

## Tech stack

- [Expo SDK 54](https://expo.dev) + React Native + [expo-router](https://docs.expo.dev/router/introduction/) (file-based navigation)
- TypeScript, strict mode
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) for local storage — no backend, ever
- expo-print / expo-sharing / expo-notifications / expo-document-picker for
  payslips, sharing, the backup reminder, and restore

## Running it

You need [Node.js](https://nodejs.org) and the [Expo Go](https://expo.dev/go)
app on an Android or iOS phone. No Android Studio, no Xcode, no native build
tools required for everyday development.

```bash
git clone https://github.com/Akshay5651/gharkhata.git
cd gharkhata
npm install
npx expo start
```

Scan the QR code Expo prints with the Expo Go app. The app opens with an
empty local database — add a worker from the Home screen to get started.

If you've pulled new changes that add a package or touch `app.json`, clear
the Metro cache on next start:

```bash
npx expo start -c
```

### Type checking

```bash
npm run typecheck
```

### Building a real APK

Building an installable APK (rather than running through Expo Go) uses
[EAS Build](https://docs.expo.dev/build/introduction/) and requires a free
Expo account:

```bash
npx eas-cli login
npm run build:apk
```

This runs entirely on Expo's build servers — no local Android SDK needed —
and gives you a download link for a real, installable `.apk`.

## Project structure

```
app/            expo-router screens (file-based routes)
  (tabs)/       Home, Calendar, Salary, Settings
  worker/[id]   add/edit worker sheet
components/     bottom-sheet UI (day editor, advances, payments, history, guide)
lib/            all business logic — no UI code
  db.ts         SQLite schema, migrations, and queries
  salary.ts     payroll calculation
  balance.ts    running advances/payments balance
  backup.ts     JSON export/import
  i18n.tsx      English/Hindi strings
  theme.tsx     dark/light color tokens
```

## Design notes worth knowing

- Money is stored as **integer paise**, never floats — a monthly salary
  divided across days would otherwise drift.
- Dates are local `YYYY-MM-DD` strings, never `Date.toISOString()`, which
  shifts the calendar day at IST (+5:30).
- A day's status is excluded from salary until it's explicitly marked —
  the app never assumes "present" on your behalf.
