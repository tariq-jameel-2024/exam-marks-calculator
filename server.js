'use strict';

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();
const root = __dirname;
const dataDirectory = path.join(root, 'data');
const port = Number(process.env.PORT) || 5500;
const baseUrl = (process.env.APP_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, '');
const callbackUrl = `${baseUrl}/auth/google/callback`;
const isProduction = process.env.NODE_ENV === 'production';
const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
const googleConfigured = Boolean(
  googleClientId && googleClientSecret &&
  !googleClientId.startsWith('replace-with-') &&
  !googleClientSecret.startsWith('replace-with-')
);
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || sessionSecret.length < 32 || sessionSecret.startsWith('replace-with-')) {
  console.error('SESSION_SECRET is required and must contain at least 32 characters. See .env.example.');
  process.exit(1);
}

fs.mkdirSync(dataDirectory, { recursive: true });
if (isProduction) app.set('trust proxy', 1);

class FileSessionStore extends session.Store {
  constructor(directory) {
    super();
    this.directory = directory;
    fs.mkdirSync(directory, { recursive: true });
    this.reaper = setInterval(() => this.removeExpired(), 60 * 60 * 1000);
    this.reaper.unref();
  }

  fileFor(sessionId) {
    const id = crypto.createHash('sha256').update(sessionId).digest('hex');
    return path.join(this.directory, `${id}.json`);
  }

  get(sessionId, callback) {
    fs.readFile(this.fileFor(sessionId), 'utf8', (error, contents) => {
      if (error && error.code === 'ENOENT') return callback(null, null);
      if (error) return callback(error);
      try {
        const record = JSON.parse(contents);
        if (record.expiresAt <= Date.now()) {
          return this.destroy(sessionId, destroyError => callback(destroyError, null));
        }
        callback(null, record.session);
      } catch (parseError) {
        callback(parseError);
      }
    });
  }

  set(sessionId, sessionData, callback = () => {}) {
    const expiresAt = sessionData.cookie && sessionData.cookie.expires
      ? new Date(sessionData.cookie.expires).getTime()
      : Date.now() + 7 * 24 * 60 * 60 * 1000;
    const target = this.fileFor(sessionId);
    const temporary = `${target}.${crypto.randomBytes(8).toString('hex')}.tmp`;
    const content = JSON.stringify({ expiresAt, session: sessionData });
    fs.writeFile(temporary, content, { encoding: 'utf8', mode: 0o600 }, writeError => {
      if (writeError) return callback(writeError);
      fs.rename(temporary, target, renameError => {
        if (renameError) {
          return fs.unlink(temporary, () => callback(renameError));
        }
        callback(null);
      });
    });
  }

  touch(sessionId, sessionData, callback) {
    this.set(sessionId, sessionData, callback);
  }

  destroy(sessionId, callback = () => {}) {
    fs.unlink(this.fileFor(sessionId), error => {
      if (error && error.code !== 'ENOENT') return callback(error);
      callback(null);
    });
  }

  removeExpired() {
    fs.readdir(this.directory, (readError, files) => {
      if (readError) return console.error('Session cleanup failed:', readError.message);
      files.filter(file => file.endsWith('.json')).forEach(file => {
        const target = path.join(this.directory, file);
        fs.readFile(target, 'utf8', (readFileError, contents) => {
          if (readFileError) return console.error('Session cleanup failed:', readFileError.message);
          try {
            const record = JSON.parse(contents);
            if (record.expiresAt <= Date.now()) {
              fs.unlink(target, unlinkError => {
                if (unlinkError && unlinkError.code !== 'ENOENT') {
                  console.error('Expired session removal failed:', unlinkError.message);
                }
              });
            }
          } catch (parseError) {
            console.error('Invalid stored session:', parseError.message);
          }
        });
      });
    });
  }
}

app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://lh3.googleusercontent.com'],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", 'https://accounts.google.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: '64kb', strict: true }));

app.use(session({
  name: 'emc.sid',
  store: new FileSessionStore(path.join(dataDirectory, 'sessions')),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));
app.use(passport.initialize());

if (googleConfigured) {
  passport.use(new GoogleStrategy({
    clientID: googleClientId,
    clientSecret: googleClientSecret,
    callbackURL: callbackUrl,
    scope: ['profile', 'email'],
    state: true
  }, (accessToken, refreshToken, profile, done) => {
    const emailEntry = Array.isArray(profile.emails) ? profile.emails[0] : null;
    done(null, {
      id: profile.id,
      name: profile.displayName || 'Student',
      email: emailEntry ? emailEntry.value : '',
      photo: Array.isArray(profile.photos) && profile.photos[0] ? profile.photos[0].value : ''
    });
  }));
}

function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

function configuredOrRedirect(req, res, next) {
  if (googleConfigured) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(503).json({
      error: 'google_not_configured',
      message: 'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.'
    });
  }
  return res.redirect('/?authError=google-not-configured');
}

app.get('/api/auth/session', noStore, (req, res) => {
  res.json({
    authenticated: Boolean(req.session.user),
    configured: googleConfigured,
    user: req.session.user || null
  });
});

app.get('/auth/google', configuredOrRedirect, passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account'
}));

app.get('/auth/google/callback',
  configuredOrRedirect,
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/?authError=google-denied'
  }),
  (req, res, next) => {
    req.session.regenerate(error => {
      if (error) return next(error);
      req.session.user = req.user;
      req.session.save(saveError => {
        if (saveError) return next(saveError);
        res.redirect('/');
      });
    });
  }
);

app.post('/auth/logout', noStore, (req, res, next) => {
  const origin = req.get('origin');
  if (origin && origin !== baseUrl) {
    return res.status(403).json({ error: 'invalid_origin', message: 'Sign-out request origin was rejected.' });
  }
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('emc.sid', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax'
    });
    res.status(204).end();
  });
});

const publicFiles = {
  '/script.js': 'script.js',
  '/style.css': 'style.css',
  '/logo.png': 'logo.png',
  '/favicon.png': 'favicon.png'
};
Object.entries(publicFiles).forEach(([url, file]) => {
  app.get(url, (_req, res, next) => {
    res.sendFile(path.join(root, file), error => {
      if (error) next(error);
    });
  });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(root, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error('Request failed:', err.message);
  if (res.headersSent) return;
  res.status(500).json({ error: 'server_error', message: 'The request could not be completed. Please try again.' });
});

app.listen(port, () => {
  console.log(`Exam Marks Calculator listening at ${baseUrl}`);
  console.log(`Google OAuth callback URL: ${callbackUrl}`);
  if (!googleConfigured) {
    console.warn('Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.');
  }
});
