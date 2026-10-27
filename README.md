# APAAR Sentinel (demo)

Page-by-page demo for AICTE Problem Statement 26263. A React and Vite app that runs in the browser with synthetic data. See [PAGES.md](PAGES.md) for the page list and recording order.

## Run

```
npm install
npm run dev        # opens on http://127.0.0.1:5173 unless that port is taken
npm run test       # engine tests (rules, forecast, signatures, audit, upload)
npm run build      # production build into dist/
```

## Demo accounts

| Role | Username | Password |
|---|---|---|
| College administrator | `college` | `college123` |
| AICTE official | `aicte` | `aicte123` |
| Student (then one-time code `123456`) | `student` | `student123` |
| Verifier (employer) | `verifier` | `verify123` |
| System administrator | `admin` | `admin123` |

The login page does not list these accounts. Type them in. Student sign-in then asks for the one-time code shown in the table above.

## Data

- Seed data lives in `src/data/*.json` and is checked at startup by `src/data/seed.ts`.
- Live changes (uploads, flag decisions, consent, corrections, signed credentials) are saved in browser `localStorage`, so a reload keeps them. Administration has a reset.
- Sign-in is checked in the browser against SHA-256 hashes in `src/data/users.json`. This is a demo of the flow, not authentication.

## Honest limits

- Forecasts use synthetic admission history.
- APAAR verification is simulated.
- Ghost-seat signals come from simulated fee, exam and attendance feeds.
- Sign-in is a demo account, not authentication. There is no server, so role checks run in the browser.
- The QR code and signed records are an implementation choice for the demo.

## Layout

- `src/engine/` rules, forecast, audit chain, signatures, upload validation, CSV (reused from `apaar-intake-guard/`).
- `src/auth/` pages per role and session.
- `src/store.tsx` app state, persisted to `localStorage`.
- `src/pages/` Institution, Aicte, StudentVerifier, Scan.
- `src/assistant/` Sentinel Assistant: fixed read-only templates, no free-form query.
