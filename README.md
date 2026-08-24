# S.P. Badminton Tourney Season 3

Modern, full-stack tournament management platform for **Suryodaya Park Badminton Tourney Season 3**.

---

## 🏸 Key Features & Portals

- **Public Portal (`/`)**: Player Registration with DOB calculation, category locking, interactive tournament schedule, knockout brackets, rules & FAQ.
- **Live Courtside TV (`/tv`)**: Fullscreen live scoreboard broadcast overlay with real-time match state, game scores, and serve indicators.
- **Scorer Desk (`/scorer`)**: Courtside umpire & scorer controls for point tracking, serve rotation, timeouts, set wins, and undo history.
- **Admin Control Panel (`/admin`)**: Player approval/rejection workflows, match schedule management, knockout bracket generation, and financial ledger.
- **Status Checker**: Instant player digital match pass verification and registration receipt generator.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: Vanilla JS / HTML5 / CSS3 & React + Vite (`client/`)
- **Backend API**: Node.js & Express (`server.js`, `routes/`, `models/`)
- **Realtime Engine**: WebSockets (`socket.io`) & MQTT Bridge
- **Database**: MongoDB (Mongoose) with zero-dependency standalone file-store fallback (`data/`)
- **Hosting & Deployment**: Vercel Serverless Architecture (`vercel.json`, `api/index.js`)

---

## 🚀 Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/blistedx/Spbt3.git
   cd Spbt3
   ```

2. **Install dependencies:**
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   *(Fill in your MongoDB URI, JWT Secret, and Admin PIN in `.env`)*

4. **Start the local server:**
   ```bash
   npm run start
   ```
   - Public Portal: `http://localhost:3000`
   - Admin Desk: `http://localhost:3000/admin`
   - Scorer Desk: `http://localhost:3000/scorer`
   - TV Scoreboard: `http://localhost:3000/tv`

---

## 📄 License
Private & Proprietary · Suryodaya Park Badminton Organizing Committee 2026.
