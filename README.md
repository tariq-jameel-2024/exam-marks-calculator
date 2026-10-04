# 🎓 Exam Marks Calculator

A professional full-stack web application designed to calculate, manage, and analyze student exam marks efficiently with Express backend and authentication support.

---

## 🚀 Features

- 📊 **Marks Calculation**: Compute total marks, percentages, and performance grades quickly.
- 🔐 **Authentication Setup**: Complete setup guide available for user authentication.
- 🌐 **Full-Stack Architecture**: Node.js and Express.js backend with plain JavaScript frontend.
- 🎨 **Responsive Interface**: Custom styled UI with branding assets (`logo.png`, `favicon.png`).
- ⚙️ **Environment Management**: Pre-configured environment variable templates.

---

## 🌐 Deploy on Render (Node.js Web Service)

1. Push this repository to GitHub.
2. In Render, create a new **Blueprint** service from this repository (it will detect `render.yaml`).
3. Confirm service settings:
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Set the required environment variables in Render:
   - `NODE_ENV=production`
   - `APP_BASE_URL` (example: `https://your-service-name.onrender.com`)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `SESSION_SECRET` (at least 32 random characters)
5. In Google Cloud OAuth settings, add this authorized redirect URI format:
   - `{APP_BASE_URL}/auth/google/callback`
   - Example: `https://your-service-name.onrender.com/auth/google/callback`
6. Deploy the service.

### Notes

- This app uses file-backed sessions/data under `data/`. For production reliability, use a Render persistent disk or run as a single instance to avoid session/data inconsistency.
- Do not commit real secrets to the repository. Keep secrets only in Render environment variable settings.

---

## 📁 Repository Structure

exam-marks-calculator/
├── .env.example       # Template for environment variables
├── .gitignore         # Git ignore configuration
├── AUTH_SETUP.md      # Detailed authentication setup guide
├── favicon.png        # Web icon asset
├── index.html         # Frontend UI layout
├── index.js           # Main application entry point
├── logo.png           # Project branding logo
├── package-lock.json  # NPM dependency lockfile
├── package.json       # Project dependencies and scripts
├── script.js          # Client-side JavaScript logic
├── server.js          # Express server and API routes
└── style.css          # Custom styling 
