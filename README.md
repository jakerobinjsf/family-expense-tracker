# Family Expense Tracker

A single-screen, installable web app for Jenny, Pat, and Marj to log shared expenses in under 10 seconds, backed by a Google Sheet.

## 1. Technology stack (free)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Plain HTML/CSS/JS (no framework, no build step) | Zero tooling to maintain, loads instantly, trivial for 3 users, easy for anyone to read and modify later. |
| Installability | Web App Manifest + Service Worker (PWA) | Free "Add to Home Screen" on both Android and iPhone, no app store needed. |
| Backend/API | Google Apps Script Web App (`doGet`/`doPost`) | Free, no server to manage, talks directly to Google Sheets, scales far beyond 3 users' needs. |
| Database | Google Sheets | Required by spec, free, and Jenny/Pat/Marj can eyeball or export the raw data anytime. |
| Hosting | GitHub Pages (or Netlify/Vercel) | Free static hosting with HTTPS, required for PWA install and camera-free "Add to Home Screen" flows. |

This avoids any paid tier: Apps Script consumer quotas (90 min execution/day, 20 simultaneous executions) are wildly more than 3 people logging a few expenses a day will ever use.

## 2. Project structure

```
family-expense-tracker/
├── index.html            # The single home screen (form + recent expenses)
├── style.css             # Mobile-first styling, large touch targets
├── app.js                # All app logic: save, list, edit, delete, grouping
├── manifest.json         # PWA manifest (install metadata)
├── service-worker.js     # Offline app-shell caching
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── apple-touch-icon.png
├── apps-script/
│   └── Code.gs           # Google Apps Script backend (paste into script editor)
└── README.md             # This file
```

## 3. Source code

All source files are in this folder. Key ones:
- [index.html](index.html) — the one-screen layout (entry form on top, Recent Expenses below).
- [style.css](style.css) — styling.
- [app.js](app.js) — fetches/saves data, groups expenses by date, handles tap-to-edit/delete.
- [apps-script/Code.gs](apps-script/Code.gs) — the API that reads/writes the Google Sheet.

## 4. Google Sheets setup

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet named **Family Expenses**.
2. You do **not** need to manually add headers — the Apps Script will create a sheet tab named `Expenses` with headers automatically the first time it runs. (If you'd rather set it up yourself, create a tab named exactly `Expenses` with header row: `ID | Timestamp | Date | Description | Amount | Category`.)
3. Note: an `ID` column (a hidden UUID) is included in addition to the columns you listed. It's required so the app can reliably edit/delete a specific row without ambiguity — it's not shown anywhere in the UI.

## 5. Google Apps Script deployment

1. In your new Google Sheet, click **Extensions → Apps Script**.
2. Delete the placeholder code and paste the contents of [apps-script/Code.gs](apps-script/Code.gs).
3. Click **Save** (name the project e.g. "Expense Tracker API").
4. Click **Deploy → New deployment**.
5. Click the gear icon next to "Select type" and choose **Web app**.
6. Configure:
   - **Execute as:** Me (your Google account)
   - **Who has access:** Anyone with the link
7. Click **Deploy**. Authorize the permissions Google asks for (it's your own script accessing your own sheet).
8. Copy the **Web app URL** it gives you (ends in `/exec`). You'll need it in the next step.

> If you later edit `Code.gs`, you must click **Deploy → Manage deployments → Edit (pencil) → New version → Deploy** for changes to go live — saving alone isn't enough.

## 6. Connect the frontend to the backend

1. Open [app.js](app.js).
2. At the top, replace:
   ```js
   const CONFIG = {
     API_URL: 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE'
   };
   ```
   with your deployed `/exec` URL from step 5.8 above.

## 7. Hosting (free) — GitHub Pages

1. Create a free GitHub account if you don't have one, and a new **public** repository (e.g. `family-expense-tracker`).
2. Upload all files in this folder to that repository (keep the folder structure — the `apps-script/` folder is harmless to include, it's just reference code).
3. Go to the repo's **Settings → Pages**.
4. Under "Build and deployment", set **Source: Deploy from a branch**, **Branch: main**, folder `/ (root)`. Save.
5. Wait ~1 minute, then GitHub will give you a URL like `https://yourusername.github.io/family-expense-tracker/`. That's the app URL to share with Jenny, Pat, and Marj.

*(Netlify Drop or Vercel work identically if you prefer — just drag the folder in; GitHub Pages is used here because it needs no framework/build config.)*

## 8. Android installation

1. Open the app URL in **Chrome**.
2. Tap the **⋮** menu (top right) → **Add to Home screen** (or you may see an automatic "Install app" banner).
3. Confirm. The app icon appears on the home screen and opens full-screen, like a native app.

## 9. iPhone installation

1. Open the app URL in **Safari** (must be Safari, not Chrome, for this to work on iOS).
2. Tap the **Share** icon (square with an arrow) in the toolbar.
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**. The app icon appears on the home screen and opens full-screen.

## 10. Limitations of this free setup

- **Access control is link-based, not per-user login.** Anyone with the app URL and the Apps Script URL can read/write the sheet. This is appropriate for 3 trusted family members but isn't "real" auth. If that ever becomes a concern, add a simple shared PIN check in `app.js`/`Code.gs`, or switch "Who has access" to "Anyone within [your Google Workspace]" if you have one.
- **Apps Script cold start:** the first request after a period of inactivity can take 1–2 seconds. Fine for this use case.
- **Offline is shell-only.** The service worker caches the app's UI so it *opens* offline, but saving/loading expenses requires an internet connection (no offline queue in this version — see enhancements below).
- **No built-in analytics/charts.** Data lives in a plain Google Sheet; any reporting today happens by opening the Sheet directly.
- **Google Apps Script quotas** (per consumer Google account): 90 min total script runtime/day, 20,000 URL Fetch calls/day, 6-minute max execution per call. Three people logging expenses will never come close to these limits.
- **Row-based storage** means very large history (tens of thousands of rows) could eventually slow down `listExpenses_()`'s per-load scan, though at normal household expense volume this is a non-issue for years.

## 11. Future enhancements (architecture already supports these)

- **Offline queueing:** store unsent expenses in IndexedDB and sync via Background Sync when connectivity returns.
- **Monthly/category summaries and simple charts** (e.g. spend by category per month) — the Sheet already has everything needed; just add a new Apps Script action + a summary view.
- **Per-user attribution:** add a "Logged by" column and a lightweight name selector (no password) so you can see who added what.
- **Search/filter** in Recent Expenses (by category or date range) beyond the rolling 7-day window.
- **CSV/PDF export** of a date range, generated via Apps Script and emailed or downloaded.
- **Budget alerts:** an Apps Script time-trigger that emails/texts when a category exceeds a monthly threshold.
- **Editable categories:** move the category list into a Settings sheet tab instead of hardcoding it, so new categories don't require a code change.
- **Dark mode** via `prefers-color-scheme` in `style.css`.
- **Simple shared PIN lock** on app open for a bit more privacy without full user accounts.

None of these require changing the core architecture (Sheets + Apps Script + static PWA) — they're additive.
