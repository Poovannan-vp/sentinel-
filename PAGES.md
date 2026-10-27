# APAAR Sentinel: page list and shot list

Written for: the team recording the demo video, so they can follow the PDF's demo script page by page.

Sign in with the demo accounts listed in README.md. Each role sees only its own sidebar.

## Recording order (PDF demo script)

| # | Sign in as | Sidebar page | What to show | PDF ref |
|---|---|---|---|---|
| 1 | College administrator (`college`) | Dashboard | Intake, active, utilisation, open flags | 9.1 |
| 2 | College administrator | Upload center | Use sample batch, Run checks, fix a correctable row, accept | 9.1 · 7 |
| 3 | College administrator | Admission forecast | Pace slider moves the breach date | 9.1 · 5 |
| 4 | AICTE official (`aicte`) | Flag review queue, then Flag detail | Rule, evidence, history; dismiss with a reason | 9.2 · 2 |
| 5 | AICTE official | Natural-language query | Ask a question; template id shown under the answer | 2 (Differentiator 2) |
| 6 | Verifier (`verifier`) | Request verification | Request one claim, signed yes/no | 9.3 · 8 |
| 7 | Public (no sign-in) | Scan result (`#/scan/<id>`) | VALID. After step 8 stops access, the same scan shows REVOKED | 8 |
| 8 | Student (`student`, OTP `123456`) | Consent dashboard | Stop access and restore it, with undo | 9.3 · DPDP |
| 9 | AICTE official | Audit log viewer | Chain check, tamper demo on a copy | 9.2 · 11 |

## All pages by role

**College administrator (Institution portal)**: Dashboard, Programmes and intake, Upload center, Student records, Admission forecast, Flags inbox, Ghost-seat review, Reports, Users and roles.

**AICTE official (AICTE portal)**: National dashboard, Forecast heatmap, Institution list and detail, Flag review queue, Flag detail (opened from the queue), Ghost-seat dashboard, Natural-language query, Duplicate candidates, Verification log, Audit log viewer, Rules and thresholds, Reports and exports.

**System administrator**: Administration (accounts, API clients, reset demo data), Rules and thresholds, Audit log viewer. Student records are not reachable from this role.

**Student**: My record, Consent dashboard, Correction request, My credential.

**Verifier (employer)**: Request verification, Result, Request history.

**Public**: Scan result (opened from the QR code).

## Blocked-page check

Opening a page outside the role's list shows "Not permitted" and writes an `access.denied` entry to the audit log.

## Notes for the recording

- Screen: laptop, 1366 by 768 or 1920 by 1080 scaled. Minimum width 1280 px.
- The student's credential page is empty until a verifier signs one. Run step 6 before step 8.
- Demo state is kept in the browser. "Reset demo data" in Administration restores the start.
- Synthetic data throughout. Forecasts, APAAR verification, activity signals and sign-on are simulated; the login page says so.
