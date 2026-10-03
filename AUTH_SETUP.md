# Google OAuth backend setup

The calculator uses a Node.js/Express backend for Google OAuth and file-backed server sessions. Google credentials stay on the server in `.env`; they are never sent to browser JavaScript.

## Local setup

1. Install Node.js 18 or newer.
2. In the project directory, install dependencies:

   ```powershell
   npm install
   ```

3. Create a local environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

4. In [Google Cloud Console](https://console.cloud.google.com/), select/create a project, configure the OAuth consent screen, and create an OAuth client ID with application type **Web application**.
5. Add this exact **Authorized redirect URI** to the Google OAuth client:

   ```text
   http://localhost:5500/auth/google/callback
   ```

6. Set the client ID and client secret in `.env`; also replace `SESSION_SECRET` with a random string of at least 32 characters. PowerShell can generate one:

   ```powershell
   [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
   ```

   `.env` values:

   ```dotenv
   NODE_ENV=development
   PORT=5500
   APP_BASE_URL=http://localhost:5500
   GOOGLE_CLIENT_ID=your-web-client-id
   GOOGLE_CLIENT_SECRET=your-web-client-secret
   SESSION_SECRET=paste-generated-random-value-here
   ```

7. Start the app and visit the same host/port used for `APP_BASE_URL`:

   ```powershell
   npm start
   ```

   Open `http://localhost:5500` (not `127.0.0.1` unless you change `APP_BASE_URL` and register that exact callback URI too).

## OAuth consent screen

- Set the app name and support email on the OAuth consent screen.
- While the Google OAuth app is in **Testing**, add each test Google account as a test user.
- For public release, complete Google's required consent-screen verification steps for the profile and email information requested by the app.
- Firebase is not used by this backend implementation.

## Session and storage behavior

- The browser is redirected to Google, and Google returns to `/auth/google/callback`. The server validates OAuth state and creates an HTTP-only, same-site session cookie.
- Sessions live as private files in `data/sessions/` and survive page refreshes and server restarts. The `data/` directory is ignored by Git.
- User profile and calculator records are isolated in browser storage by the Google account's stable ID. Records are not synchronized between devices.
- In production, use HTTPS, set `NODE_ENV=production`, set `APP_BASE_URL` to the canonical HTTPS URL, use a strong persistent `SESSION_SECRET`, and register `https://your-host/auth/google/callback` as an authorized redirect URI in Google Cloud. Use persistent private storage for `data/sessions/`; a multi-instance deployment needs a shared session store.
- Never commit `.env` or share `GOOGLE_CLIENT_SECRET` or `SESSION_SECRET`. The `.gitignore` excludes `.env` and the session data directory. The backend serves only the calculator's required public assets, not its environment or session files.
