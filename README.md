# S.P. Badminton Tourney 3 · Google Apps Script Project

Official Google Apps Script Web App for **S.P. Badminton Tourney 3**.

---

## 📁 Pure Google Apps Script (GAS) Project Structure

| File | Type | Description |
|---|---|---|
| [`Code.gs`](file:///d:/Private/sp3/Code.gs) | Script (`.gs`) | Core Google Apps Script Backend (API, Database Handlers, Drive Uploads, Verification, Email Confirmations) |
| [`index.html`](file:///d:/Private/sp3/index.html) | HTML | Public Portal: Player Registration Form, Tournament Rules, Verification Status Check |
| [`admin.html`](file:///d:/Private/sp3/admin.html) | HTML | Admin Portal: Player Management, Approvals, Fixtures, Knockout Bracket, Financial Ledger (PIN: `9903`) |
| [`scorer.html`](file:///d:/Private/sp3/scorer.html) | HTML | Live Scorer Desk: Court Point Scoring, Serve Tracking, Set Wins, MQTT Realtime Broadcast |
| [`tv.html`](file:///d:/Private/sp3/tv.html) | HTML | TV Scoreboard: Fullscreen live broadcast graphic overlay for live streams / arena screens |
| [`appsscript.json`](file:///d:/Private/sp3/appsscript.json) | JSON | Google Apps Script Manifest & Web App Permissions |

---

## 🚀 How to Deploy in Google Apps Script

1. Open your Google Sheet &rarr; Click **Extensions &rarr; Apps Script**.
2. Copy & Paste the files into your Apps Script project:
   - `Code.gs` &rarr; In `Code.gs` file
   - `index.html` &rarr; Click **+ > HTML** &rarr; Name: `index`
   - `admin.html` &rarr; Click **+ > HTML** &rarr; Name: `admin`
   - `scorer.html` &rarr; Click **+ > HTML** &rarr; Name: `scorer`
   - `tv.html` &rarr; Click **+ > HTML** &rarr; Name: `tv`
3. Click **Deploy &rarr; Manage Deployments**:
   - Click **Edit (Pencil icon)** &rarr; Version: **New Version**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**
4. Access all portals via your Web App URL:
   - Public / Home: `https://script.google.com/macros/s/YOUR_ID/exec`
   - Admin Portal: `https://script.google.com/macros/s/YOUR_ID/exec?page=admin`
   - Scorer Desk: `https://script.google.com/macros/s/YOUR_ID/exec?page=scorer`
   - TV Broadcast: `https://script.google.com/macros/s/YOUR_ID/exec?page=tv`
