require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const NIGHTBOT_CLIENT_ID = process.env.NIGHTBOT_CLIENT_ID || '';
const NIGHTBOT_CLIENT_SECRET = process.env.NIGHTBOT_CLIENT_SECRET || '';
const JWT_SECRET = process.env.JWT_SECRET || 'fav-twitch-jwt-secret-change-me';
let BASE_URL = process.env.BASE_URL || process.env.VERCEL_URL || `http://localhost:${PORT}`;
if (BASE_URL && !BASE_URL.startsWith('http')) {
  BASE_URL = `https://${BASE_URL}`;
}
BASE_URL = BASE_URL.replace(/\/+$/, '');
const COOKIE_NAME = 'tw_auth';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const SCOPES = [
  'user:read:email',
  'user:read:follows',
  'user:read:moderated_channels',
  'channel:moderate',
  'chat:edit',
  'chat:read',
  'moderator:manage:banned_users',
  'moderator:read:chatters',
  'moderator:manage:announcements',
  'moderator:manage:chat_settings',
  'moderator:read:followers',
  'moderator:manage:shield_mode',
  'channel:manage:moderators',
  'channel:manage:vips',
  'channel:manage:polls',
  'channel:manage:predictions',
  'channel:read:predictions',
  'channel:manage:raids',
  'channel:read:hype_train',
  'channel:manage:redemptions',
  'channel:read:redemptions',
  'channel:read:stream_key',
  'channel:read:ads',
  'channel:manage:ads',
  'channel:edit:commercial',
  'channel:read:goals',
  'clips:edit',
  'user:edit:follows',
  'user:read:broadcast',
  'user:edit:broadcast',
  'moderation:read',
  'bits:read',
  'user:write:chat',
  'channel:manage:broadcast'
].join(' ');

// Server-side state
const viewerHistory = [];
const followerSnapshots = [];
const actionLog = [];
const bannedWords = new Set();
let lastViewerSampleTime = 0;
let lastFollowerSampleTime = 0;

// ===== CUSTOM COMMANDS (server-side) =====
const customCommands = new Map(); // channelId -> [{id, name, response, enabled, cooldown, permissions}]
const commandCooldowns = new Map(); // `${channelId}:${commandName}:${userId}` -> lastUsedTimestamp

// ===== TEAM CHAT (owner <-> moderators) =====
const teamChatMessages = new Map(); // channelId -> [{id, senderId, senderName, senderImage, senderRole, message, timestamp}]

const TEAM_CHAT_KEY = 'fav-twitch:teamChat';

async function loadTeamChatFromRedis() {
  if (!REDIS_URL) return;
  try {
    const raw = await redisGet(TEAM_CHAT_KEY);
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (data && typeof data === 'object') {
      teamChatMessages.clear();
      Object.entries(data).forEach(([k, v]) => {
        if (Array.isArray(v)) teamChatMessages.set(k, v.slice(-500));
      });
    }
  } catch {}
}

async function saveTeamChatToRedis() {
  if (!REDIS_URL) return;
  const obj = {};
  teamChatMessages.forEach((v, k) => { obj[k] = v.slice(-500); });
  try { await redisSet(TEAM_CHAT_KEY, obj); } catch {}
}

// ===== ALERT TEMPLATES =====
const alertTemplates = new Map(); // channelId -> {follow: {message, duration, sound}, sub: {...}, bits: {...}, raid: {...}}

// ===== EMAIL DIGEST =====
const emailConfigs = new Map(); // channelId -> {email, smtpHost, smtpPort, smtpUser, smtpPass, enabled, lastSent}

// ===== EVENTSUB WEBSOCKET (for chat command detection) =====
let eventsubWs = null;
let eventsubSessionId = null;
let eventsubKeepalive = null;
let eventsubBroadcasterId = null;
let eventsubConnected = false;

// ===== NIGHTBOT INTEGRATION =====
const nightbotTokens = new Map(); // channelId -> { accessToken, refreshToken, expiresAt, user }

// Moderator access system
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

async function redisGet(key) {
  if (!REDIS_URL) return null;
  try {
    const resp = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.result;
  } catch {
    return null;
  }
}

async function redisSet(key, value) {
  if (!REDIS_URL) return;
  const resp = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(value)
  });
  if (!resp.ok) throw new Error(`Redis SET failed: ${resp.status}`);
}

const moderatorAccounts = new Map();
const ownerTokens = new Map();

function migrateRedisData(data) {
  if (!data || typeof data !== 'object') return { data, migrated: false };
  if (data.hasOwnProperty('value') && typeof data.value === 'string') {
    try {
      const fixed = JSON.parse(data.value);
      if (fixed && typeof fixed === 'object') {
        const merged = { ...fixed };
        Object.entries(data).forEach(([k, v]) => { if (k !== 'value') merged[k] = v; });
        return { data: merged, migrated: true };
      }
    } catch {}
  }
  return { data, migrated: false };
}

async function loadFromRedis() {
  if (!REDIS_URL) return;
  try {
    const [tokensRaw, accountsRaw, nightbotRaw, teamChatRaw] = await Promise.all([
      redisGet('fav-twitch:ownerTokens'),
      redisGet('fav-twitch:moderatorAccounts'),
      redisGet('fav-twitch:nightbotTokens'),
      redisGet(TEAM_CHAT_KEY)
    ]);
    let tokens = typeof tokensRaw === 'string' ? JSON.parse(tokensRaw) : tokensRaw;
    let accounts = typeof accountsRaw === 'string' ? JSON.parse(accountsRaw) : accountsRaw;
    let nightbot = typeof nightbotRaw === 'string' ? JSON.parse(nightbotRaw) : nightbotRaw;
    const tMigrate = migrateRedisData(tokens);
    const aMigrate = migrateRedisData(accounts);
    tokens = tMigrate.data;
    accounts = aMigrate.data;
    ownerTokens.clear();
    moderatorAccounts.clear();
    nightbotTokens.clear();
    if (tokens && typeof tokens === 'object') Object.entries(tokens).forEach(([k, v]) => ownerTokens.set(k, v));
    if (accounts && typeof accounts === 'object') Object.entries(accounts).forEach(([k, v]) => moderatorAccounts.set(k, v));
    if (nightbot && typeof nightbot === 'object') Object.entries(nightbot).forEach(([k, v]) => nightbotTokens.set(k, v));
    // Load team chat
    let teamChat = typeof teamChatRaw === 'string' ? JSON.parse(teamChatRaw) : teamChatRaw;
    if (teamChat && typeof teamChat === 'object') {
      teamChatMessages.clear();
      Object.entries(teamChat).forEach(([k, v]) => { if (Array.isArray(v)) teamChatMessages.set(k, v.slice(-500)); });
    }
    if (tMigrate.migrated || aMigrate.migrated) await saveToRedis();
  } catch (err) {
    console.error('Failed to load from Redis:', err.message);
  }
}

async function saveToRedis() {
  if (!REDIS_URL) return;
  const obj = { ownerTokens: {}, moderatorAccounts: {}, nightbotTokens: {} };
  ownerTokens.forEach((v, k) => obj.ownerTokens[k] = v);
  moderatorAccounts.forEach((v, k) => obj.moderatorAccounts[k] = v);
  nightbotTokens.forEach((v, k) => obj.nightbotTokens[k] = v);
  const chatObj = {};
  teamChatMessages.forEach((v, k) => { chatObj[k] = v.slice(-500); });
  try {
    await Promise.all([
      redisSet('fav-twitch:ownerTokens', obj.ownerTokens),
      redisSet('fav-twitch:moderatorAccounts', obj.moderatorAccounts),
      redisSet('fav-twitch:nightbotTokens', obj.nightbotTokens),
      redisSet(TEAM_CHAT_KEY, chatObj)
    ]);
  } catch (err) {
    console.error('Failed to save to Redis:', err.message);
  }
}

app.use(cookieParser());
app.use(express.json());
app.use(async (req, res, next) => {
  await loadFromRedis();
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}



function getModeratorName(req) {
  if (req.moderatorSession) return req.auth.user.display_name || req.auth.user.login;
  return req.auth.user.display_name || req.auth.user.login;
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  const decoded = token ? verifyToken(token) : null;
  if (decoded) {
    if ((decoded.role === 'moderator' || decoded.role === 'admin') && decoded.selectedChannelId) {
      let ownerData = null;
      if (decoded.ownerAccessToken && decoded.ownerUser) {
        ownerData = {
          user: decoded.ownerUser,
          accessToken: decoded.ownerAccessToken,
          refreshToken: decoded.ownerRefreshToken
        };
      } else {
        ownerData = ownerTokens.get(decoded.selectedChannelId);
      }
      if (!ownerData) {
        if (req.path.startsWith('/api/')) {
          return res.status(401).json({ error: 'Owner not connected' });
        }
        return res.status(401).send('Owner not connected');
      }
      req.auth = {
        user: ownerData.user,
        accessToken: ownerData.accessToken,
        refreshToken: ownerData.refreshToken
      };
      req.moderatorSession = decoded;
      if (decoded.role === 'admin') {
        req.adminSession = {
          user: decoded.user,
          accessToken: decoded.accessToken,
          refreshToken: decoded.refreshToken
        };
      }
    } else {
      req.auth = {
        user: decoded.user,
        accessToken: decoded.accessToken,
        refreshToken: decoded.refreshToken
      };
    }
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.status(401).send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - No autenticado</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0e0a1a;
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #e0d4f5;
      text-align: center;
    }
    .container { padding: 40px; }
    .error-code {
      font-size: 6rem;
      font-weight: 900;
      background: linear-gradient(135deg, #a855f7, #ec4899, #6366f1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      line-height: 1;
      margin-bottom: 16px;
    }
    .error-msg {
      font-size: 1.6rem;
      font-weight: 700;
      color: #c4b5fd;
      margin-bottom: 40px;
    }
    .btn-login {
      display: inline-block;
      padding: 14px 40px;
      background: linear-gradient(135deg, #a855f7, #7c3aed);
      color: #fff;
      font-size: 1.1rem;
      font-weight: 600;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      text-decoration: none;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn-login:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(168,85,247,0.4);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-code">404</div>
    <div class="error-msg">NO ESTAS LOGUEADO</div>
    <a href="/auth/twitch" class="btn-login">Loguearse</a>
  </div>
</body>
</html>`);
}

async function refreshAccessToken(authData) {
  if (!authData.refreshToken) return null;
  try {
    const resp = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: authData.refreshToken,
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET
      })
    });
    const data = await resp.json();
    if (data.access_token) {
      return {
        user: authData.user,
        accessToken: data.access_token,
        refreshToken: data.refresh_token
      };
    }
    return null;
  } catch {
    return null;
  }
}

function setAuthCookie(res, authData) {
  const token = signToken(authData);
  res.cookie(COOKIE_NAME, token, {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.VERCEL,
    sameSite: 'lax',
    path: '/'
  });
}

function setAuthCookiePreservingSession(res, authData, req) {
  const currentToken = req.cookies[COOKIE_NAME];
  const currentDecoded = currentToken ? verifyToken(currentToken) : null;
  const payload = {
    user: authData.user,
    accessToken: authData.accessToken,
    refreshToken: authData.refreshToken
  };
  if (currentDecoded) {
    if (currentDecoded.role) payload.role = currentDecoded.role;
    if (currentDecoded.selectedChannelId) payload.selectedChannelId = currentDecoded.selectedChannelId;
    if (currentDecoded.ownerAccessToken) payload.ownerAccessToken = currentDecoded.ownerAccessToken;
    if (currentDecoded.ownerRefreshToken) payload.ownerRefreshToken = currentDecoded.ownerRefreshToken;
    if (currentDecoded.ownerUser) payload.ownerUser = currentDecoded.ownerUser;
  }
  setAuthCookie(res, payload);
}

async function twitchAPI(req, res, endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `https://api.twitch.tv/helix${endpoint}`;
  const method = options.method || 'GET';
  const headers = {
    'Client-ID': TWITCH_CLIENT_ID,
    'Authorization': `Bearer ${req.auth.accessToken}`,
    ...options.headers
  };

  let fetchOptions = { method, headers };

  if (options.body) {
    if (options.body instanceof URLSearchParams) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      fetchOptions.body = options.body.toString();
    } else {
      headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(options.body);
    }
  }

  try {
    let resp = await fetch(url, fetchOptions);

    if (resp.status === 401) {
      const refreshed = await refreshAccessToken(req.auth);
      if (refreshed) {
        req.auth = refreshed;
        setAuthCookiePreservingSession(res, refreshed, req);
        headers['Authorization'] = `Bearer ${refreshed.accessToken}`;
        fetchOptions.headers = headers;
        resp = await fetch(url, fetchOptions);
      }
    }

    if (resp.status === 204) return { status: 204 };

    const text = await resp.text();
    try {
      return { status: resp.status, data: JSON.parse(text) };
    } catch {
      return { status: resp.status, data: text };
    }
  } catch (err) {
    console.error('Twitch API Error:', err.message);
    return { status: 500, data: { error: 'NetworkError', message: err.message } };
  }
}

// Auth routes
app.get('/auth/twitch', (req, res) => {
  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: `${BASE_URL}/auth/twitch/callback`,
    response_type: 'code',
    scope: SCOPES,
    force_verify: 'false'
  });
  res.redirect(`https://id.twitch.tv/oauth2/authorize?${params}`);
});

app.get('/auth/twitch/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/?error=no_code');

  try {
    const tokenResp = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${BASE_URL}/auth/twitch/callback`
      })
    });
    const tokenData = await tokenResp.json();

    if (!tokenData.access_token) {
      return res.redirect('/?error=token_failed');
    }

    const userResp = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    const userData = await userResp.json();

    const authData = {
      user: userData.data && userData.data[0] ? userData.data[0] : null,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token
    };

    if (!authData.user) {
      return res.redirect('/?error=user_fetch_failed');
    }

    setAuthCookie(res, authData);
    ownerTokens.set(authData.user.id, authData);
    await saveToRedis();
    res.redirect('/channels');
  } catch (err) {
    console.error('Auth error:', err);
    res.redirect('/?error=auth_failed');
  }
});

app.get('/auth/logout', (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  const decoded = token ? verifyToken(token) : null;
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.redirect('/');
});

// ===== NIGHTBOT OAUTH =====
const NIGHTBOT_SCOPES = ['commands', 'commands_default', 'channel', 'channel_send'];

app.get('/auth/nightbot', requireAuth, (req, res) => {
  if (!NIGHTBOT_CLIENT_ID) return res.status(400).json({ error: 'Nightbot client ID not configured' });
  const params = new URLSearchParams({
    client_id: NIGHTBOT_CLIENT_ID,
    redirect_uri: `${BASE_URL}/auth/nightbot/callback`,
    response_type: 'code',
    scope: NIGHTBOT_SCOPES.join(' '),
    state: req.auth.user.id
  });
  res.redirect(`https://api.nightbot.tv/oauth2/authorize?${params}`);
});

app.get('/auth/nightbot/callback', async (req, res) => {
  const { code, state: channelId, error } = req.query;
  if (error) return res.redirect('/dashboard?nightbot=denied');
  if (!code) return res.redirect('/dashboard?nightbot=no_code');

  try {
    const tokenResp = await fetch('https://api.nightbot.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: NIGHTBOT_CLIENT_ID,
        client_secret: NIGHTBOT_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${BASE_URL}/auth/nightbot/callback`
      })
    });
    const tokenData = await tokenResp.json();

    if (!tokenData.access_token) {
      return res.redirect('/dashboard?nightbot=token_failed');
    }

    // Fetch Nightbot user info
    const userResp = await fetch('https://api.nightbot.tv/1/me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const userData = await userResp.json();

    const nbUser = userData.user || {};
    nightbotTokens.set(channelId, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
      user: { id: nbUser._id, name: nbUser.name, displayName: nbUser.displayName }
    });
    await saveToRedis();
    res.redirect('/dashboard?nightbot=connected');
  } catch (err) {
    console.error('Nightbot auth error:', err);
    res.redirect('/dashboard?nightbot=error');
  }
});

async function refreshNightbotToken(channelId) {
  const nbData = nightbotTokens.get(channelId);
  if (!nbData || !nbData.refreshToken) return null;
  try {
    const resp = await fetch('https://api.nightbot.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: NIGHTBOT_CLIENT_ID,
        client_secret: NIGHTBOT_CLIENT_SECRET,
        grant_type: 'refresh_token',
        redirect_uri: `${BASE_URL}/auth/nightbot/callback`,
        refresh_token: nbData.refreshToken
      })
    });
    const data = await resp.json();
    if (!data.access_token) return null;
    nbData.accessToken = data.access_token;
    nbData.refreshToken = data.refresh_token;
    nbData.expiresAt = Date.now() + (data.expires_in * 1000);
    nightbotTokens.set(channelId, nbData);
    await saveToRedis();
    return nbData.accessToken;
  } catch {
    return null;
  }
}

async function getNightbotToken(channelId) {
  const nbData = nightbotTokens.get(channelId);
  if (!nbData) return null;
  if (nbData.expiresAt && Date.now() > nbData.expiresAt - 60000) {
    return await refreshNightbotToken(channelId);
  }
  return nbData.accessToken;
}

async function nightbotApi(channelId, method, endpoint, body) {
  const token = await getNightbotToken(channelId);
  if (!token) return { error: 'Nightbot not connected' };
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };
  if (body && method !== 'GET') {
    opts.body = new URLSearchParams(body).toString();
  }
  const resp = await fetch(`https://api.nightbot.tv/1${endpoint}`, opts);
  const data = await resp.json();
  if (resp.status === 401) {
    const newToken = await refreshNightbotToken(channelId);
    if (newToken) {
      opts.headers['Authorization'] = `Bearer ${newToken}`;
      const retry = await fetch(`https://api.nightbot.tv/1${endpoint}`, opts);
      return await retry.json();
    }
  }
  return data;
}

app.get('/auth/me', async (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  const decoded = token ? verifyToken(token) : null;
  if (!decoded) {
    return res.json({ authenticated: false });
  }
  if (decoded.user) {
    const response = {
      authenticated: true,
      user: decoded.user,
      role: decoded.role || null,
      selectedChannelId: decoded.selectedChannelId || null,
      isAdmin: ADMIN_USERS.includes((decoded.user.login || '').toLowerCase())
    };
    if ((decoded.role === 'moderator' || decoded.role === 'admin') && decoded.selectedChannelId) {
      let ownerUser = decoded.ownerUser || null;
      if (!ownerUser) {
        const ownerData = ownerTokens.get(decoded.selectedChannelId);
        if (ownerData && ownerData.user) ownerUser = ownerData.user;
      }
      if (!ownerUser && decoded.accessToken) {
        try {
          const resp = await fetch(`https://api.twitch.tv/helix/users?id=${decoded.selectedChannelId}`, {
            headers: { 'Authorization': `Bearer ${decoded.accessToken}`, 'Client-Id': TWITCH_CLIENT_ID }
          });
          const data = await resp.json();
          if (data.data && data.data[0]) ownerUser = data.data[0];
        } catch {}
      }
      if (ownerUser) response.ownerUser = ownerUser;
    }
    return res.json(response);
  }
  res.json({ authenticated: false });
});

// ===== MODERATOR ACCESS SYSTEM =====
function requireOwner(req, res, next) {
  if (req.moderatorSession) {
    return res.status(403).json({ error: 'Owner access required' });
  }
  next();
}

app.get('/api/owner/moderators', requireAuth, requireOwner, (req, res) => {
  const mods = [];
  moderatorAccounts.forEach((val) => {
    if (val.ownerId === req.auth.user.id) {
      mods.push({ id: val.id, twitchUsername: val.twitchUsername, twitchUserId: val.twitchUserId, createdAt: val.createdAt });
    }
  });
  res.json({ data: mods });
});

app.post('/api/owner/moderators/add', requireAuth, requireOwner, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  const cleanUsername = username.trim().toLowerCase();

  const userResult = await twitchAPI(req, res, `/users?login=${cleanUsername}`);
  if (!userResult.data || !userResult.data.data || userResult.data.data.length === 0) {
    return res.status(404).json({ error: 'Usuario de Twitch no encontrado' });
  }
  const twitchUser = userResult.data.data[0];

  const key = `${req.auth.user.id}:${twitchUser.id}`;
  if (moderatorAccounts.has(key)) {
    return res.status(400).json({ error: 'Este usuario ya es moderador de tu canal' });
  }

  const mod = {
    id: 'mod_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    twitchUserId: twitchUser.id,
    twitchUsername: twitchUser.login,
    twitchDisplayName: twitchUser.display_name,
    twitchProfileImage: twitchUser.profile_image_url,
    ownerId: req.auth.user.id,
    createdAt: new Date().toISOString()
  };
  moderatorAccounts.set(key, mod);
  await saveToRedis();
  res.json({ data: { id: mod.id, twitchUsername: mod.twitchUsername, twitchDisplayName: mod.twitchDisplayName, createdAt: mod.createdAt } });
});

app.get('/api/user/moderated-channels', requireAuth, async (req, res) => {
  const myUserId = req.auth.user.id;
  const ownerIds = [];
  moderatorAccounts.forEach((val) => {
    if (val.twitchUserId === myUserId && !ownerIds.includes(val.ownerId)) {
      ownerIds.push(val.ownerId);
    }
  });
  if (ownerIds.length === 0) return res.json({ data: [] });
  const idsParam = ownerIds.map(id => `id=${id}`).join('&');
  const usersResult = await twitchAPI(req, res, `/users?${idsParam}`);
  if (usersResult.status !== 200 || !usersResult.data || !usersResult.data.data) {
    return res.json({ data: [] });
  }
  const usersMap = {};
  usersResult.data.data.forEach(u => { usersMap[u.id] = u; });
  const channels = ownerIds.map(ownerId => {
    const u = usersMap[ownerId];
    if (!u) return null;
    return { broadcaster_id: u.id, broadcaster_login: u.login, broadcaster_name: u.display_name, broadcaster_profile_image: u.profile_image_url };
  }).filter(Boolean);
  res.json({ data: channels });
});

app.get('/api/channel/verify', requireAuth, (req, res) => {
  const channelId = req.query.channel_id;
  if (!channelId) return res.status(400).json({ error: 'channel_id required' });
  if (req.adminSession) {
    return res.json({ allowed: true, role: 'admin' });
  }
  const myUserId = req.moderatorSession ? req.moderatorSession.user.id : req.auth.user.id;
  if (channelId === myUserId) {
    return res.json({ allowed: true, role: 'owner' });
  }
  const key = `${channelId}:${myUserId}`;
  if (moderatorAccounts.has(key)) {
    return res.json({ allowed: true, role: 'moderator' });
  }
  res.json({ allowed: false });
});

app.get('/api/channel/info', requireAuth, async (req, res) => {
  const channelId = req.query.channel_id;
  if (!channelId) return res.status(400).json({ error: 'channel_id required' });
  const result = await twitchAPI(req, res, `/channels?broadcaster_id=${channelId}`);
  res.json(result);
});

app.post('/api/owner/moderators/:id', requireAuth, requireOwner, async (req, res) => {
  let found = false;
  for (const [key, val] of moderatorAccounts) {
    if (val.id === req.params.id && val.ownerId === req.auth.user.id) {
      moderatorAccounts.delete(key);
      found = true;
    }
  }
  if (!found) return res.status(404).json({ error: 'Moderator not found' });
  await saveToRedis();
  res.json({ status: 204 });
});

app.delete('/api/owner/moderators/:id', requireAuth, requireOwner, async (req, res) => {
  let found = false;
  for (const [key, val] of moderatorAccounts) {
    if (val.id === req.params.id && val.ownerId === req.auth.user.id) {
      moderatorAccounts.delete(key);
      found = true;
    }
  }
  if (!found) return res.status(404).json({ error: 'Moderator not found' });
  await saveToRedis();
  res.json({ status: 204 });
});

const ADMIN_USERS = ['elmarcels_'];

app.post('/auth/select-channel', requireAuth, async (req, res) => {
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ error: 'channelId required' });
  const isAdmin = ADMIN_USERS.includes((req.auth.user.login || '').toLowerCase());
  let role = 'owner';
  if (channelId !== req.auth.user.id) {
    if (isAdmin) {
      role = 'admin';
    } else {
      const key = `${channelId}:${req.auth.user.id}`;
      if (!moderatorAccounts.has(key)) {
        return res.status(403).json({ error: 'Not authorized for this channel' });
      }
      role = 'moderator';
    }
  }
  const token = req.cookies[COOKIE_NAME];
  const decoded = token ? verifyToken(token) : null;
  if (!decoded) return res.status(401).json({ error: 'Not authenticated' });

  if (role === 'owner') {
    ownerTokens.set(channelId, {
      user: decoded.user,
      accessToken: decoded.accessToken,
      refreshToken: decoded.refreshToken
    });
    await saveToRedis();
  }

  const payload = {
    user: decoded.user,
    accessToken: decoded.accessToken,
    refreshToken: decoded.refreshToken,
    selectedChannelId: channelId,
    role: role
  };

  if (role === 'moderator' || role === 'admin') {
    let ownerData = ownerTokens.get(channelId);
    if (ownerData) {
      payload.ownerAccessToken = ownerData.accessToken;
      payload.ownerRefreshToken = ownerData.refreshToken;
      payload.ownerUser = ownerData.user;
    } else if (decoded.accessToken) {
      try {
        const resp = await fetch(`https://api.twitch.tv/helix/users?id=${channelId}`, {
          headers: { 'Authorization': `Bearer ${decoded.accessToken}`, 'Client-Id': TWITCH_CLIENT_ID }
        });
        const data = await resp.json();
        if (data.data && data.data[0]) payload.ownerUser = data.data[0];
      } catch {}
    }
  }

  const selectedToken = signToken(payload);
  res.cookie(COOKIE_NAME, selectedToken, {
    maxAge: COOKIE_MAX_AGE, httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.VERCEL,
    sameSite: 'lax', path: '/'
  });
  res.json({ success: true });
});

// User info
app.get('/api/user', requireAuth, async (req, res) => {
  res.json(req.auth.user);
});

// Moderation
app.get('/api/mod/chatters', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/chat/chatters?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}`);
  res.json(result);
});

app.post('/api/mod/ban', requireAuth, async (req, res) => {
  const { user_id, reason, duration } = req.body;
  const body = { data: { user_id, reason: reason || '' } };
  if (duration) body.data.duration = duration;
  const result = await twitchAPI(req, res, `/moderation/bans?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}`, {
    method: 'POST',
    body
  });
  res.json(result);
});

app.delete('/api/mod/unban', requireAuth, async (req, res) => {
  const user_id = req.query.user_id || (req.body && req.body.user_id);
  const result = await twitchAPI(req, res, `/moderation/bans?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}&user_id=${user_id}`, {
    method: 'DELETE'
  });
  res.json(result);
});

app.post('/api/mod/timeout', requireAuth, async (req, res) => {
  const { user_id, duration, reason } = req.body;
  const result = await twitchAPI(req, res, `/moderation/bans?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}`, {
    method: 'POST',
    body: { data: { user_id, duration: duration || 600, reason: reason || 'Timeout' } }
  });
  res.json(result);
});

app.post('/api/mod/untimeout', requireAuth, async (req, res) => {
  const { user_id } = req.body;
  const result = await twitchAPI(req, res, `/moderation/bans?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}&user_id=${user_id}`, {
    method: 'DELETE'
  });
  res.json(result);
});

app.post('/api/mod/announce', requireAuth, async (req, res) => {
  const { message, color } = req.body;
  const result = await twitchAPI(req, res, `/chat/announcements?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}`, {
    method: 'POST',
    body: { message, color: color || 'primary' }
  });
  res.json(result);
});

// Followers (with profile images via /users)
app.get('/api/mod/followers', requireAuth, async (req, res) => {
  try {
    const after = req.query.after || '';
    let endpoint = `/channels/followers?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}&first=100`;
    if (after) endpoint += `&after=${after}`;
    const result = await twitchAPI(req, res, endpoint);
    if (result.status !== 200 || !result.data || !result.data.data) {
      return res.json({ status: result.status, data: { data: [], error: result.data } });
    }
    const followerIds = result.data.data.map(f => f.user_id);
    if (followerIds.length > 0) {
      const profileMap = {};
      for (let i = 0; i < followerIds.length; i += 100) {
        const chunk = followerIds.slice(i, i + 100);
        const idsParam = chunk.map(id => `id=${id}`).join('&');
        const usersResult = await twitchAPI(req, res, `/users?${idsParam}`);
        if (usersResult.data && usersResult.data.data) {
          for (const u of usersResult.data.data) {
            profileMap[u.id] = u.profile_image_url;
          }
        }
      }
      for (const f of result.data.data) {
        f.user_profile_image_url = profileMap[f.user_id] || '';
      }
    }
    const pagination = result.data.pagination || {};
    res.json({ status: result.status, data: result.data, pagination });
  } catch (err) {
    res.json({ status: 500, data: { data: [], error: err.message } });
  }
});

// Search users by login
app.get('/api/users/search', requireAuth, async (req, res) => {
  const { login } = req.query;
  if (!login) return res.json({ data: [] });
  const result = await twitchAPI(req, res, `/users?login=${login}`);
  res.json(result);
});

// Admin: search any Twitch user by login (admin-only)
app.get('/api/admin/search-user', requireAuth, async (req, res) => {
  if (!req.adminSession) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const { login } = req.query;
  if (!login || login.length < 2) return res.json({ data: [] });
  try {
    const resp = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, {
      headers: {
        'Authorization': `Bearer ${req.adminSession.accessToken}`,
        'Client-Id': TWITCH_CLIENT_ID
      }
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error searching users' });
  }
});

// Channel Points
app.get('/api/channel-points/rewards', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/channel_points/custom_rewards?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

app.post('/api/channel-points/rewards', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/channel_points/custom_rewards?broadcaster_id=${req.auth.user.id}`, {
    method: 'POST',
    body: req.body
  });
  res.json(result);
});

app.patch('/api/channel-points/rewards/:rewardId', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/channel_points/custom_rewards?broadcaster_id=${req.auth.user.id}&id=${req.params.rewardId}`, {
    method: 'PATCH',
    body: req.body
  });
  res.json(result);
});

app.delete('/api/channel-points/rewards/:rewardId', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/channel_points/custom_rewards?broadcaster_id=${req.auth.user.id}&id=${req.params.rewardId}`, {
    method: 'DELETE'
  });
  res.json(result);
});

app.get('/api/channel-points/rewards/:rewardId/redemptions', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/channel_points/custom_rewards/redemptions?broadcaster_id=${req.auth.user.id}&reward_id=${req.params.rewardId}&status=${req.query.status || 'UNFULFILLED'}`);
  res.json(result);
});

app.patch('/api/channel-points/rewards/:rewardId/redemptions', requireAuth, async (req, res) => {
  const { ids, status } = req.body;
  const idsParam = ids.map(id => `id=${id}`).join('&');
  const result = await twitchAPI(req, res, `/channel_points/custom_rewards/redemptions?broadcaster_id=${req.auth.user.id}&reward_id=${req.params.rewardId}&${idsParam}`, {
    method: 'PATCH',
    body: { status }
  });
  res.json(result);
});

// Stream info
app.get('/api/stream', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/streams?user_id=${req.auth.user.id}`);
  res.json(result);
});

app.get('/api/stream/tags', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/tags/streams?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

app.get('/api/categories/search', requireAuth, async (req, res) => {
  const { name } = req.query;
  if (!name) return res.json({ data: [] });
  const result = await twitchAPI(req, res, `/search/categories?query=${encodeURIComponent(name)}`);
  res.json(result);
});

app.patch('/api/stream/info', requireAuth, async (req, res) => {
  const { title, game_id, tags, is_live, language } = req.body;
  const body = {};
  if (title !== undefined) body.title = title;
  if (game_id !== undefined) body.game_id = game_id;
  if (tags !== undefined) body.tags = tags;
  if (is_live !== undefined) body.is_live = is_live;
  if (language !== undefined) body.language = language;

  const result = await twitchAPI(req, res, `/channels?broadcaster_id=${req.auth.user.id}`, {
    method: 'PATCH',
    body
  });
  res.json(result);
});

app.get('/api/channel', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/channels?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

// Chat settings
app.get('/api/chat/settings', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/chat/settings?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}`);
  res.json(result);
});

app.patch('/api/chat/settings', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/chat/settings?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}`, {
    method: 'PATCH',
    body: req.body
  });
  res.json(result);
});

// Emotes
app.get('/api/emotes/global', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, '/emotes/global');
  res.json(result);
});

// Predictions
app.get('/api/predictions', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/predictions?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

app.post('/api/predictions', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, '/predictions', {
    method: 'POST',
    body: { ...req.body, broadcaster_id: req.auth.user.id }
  });
  res.json(result);
});

app.patch('/api/predictions/:predictionId', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, '/predictions', {
    method: 'PATCH',
    body: { ...req.body, broadcaster_id: req.auth.user.id }
  });
  res.json(result);
});

// Polls
app.get('/api/polls', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/polls?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

app.post('/api/polls', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, '/polls', {
    method: 'POST',
    body: { ...req.body, broadcaster_id: req.auth.user.id }
  });
  res.json(result);
});

app.patch('/api/polls/:pollId', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, '/polls', {
    method: 'PATCH',
    body: { ...req.body, broadcaster_id: req.auth.user.id, id: req.params.pollId }
  });
  res.json(result);
});

// Raids
app.post('/api/raids/start', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/raids?from_broadcaster_id=${req.auth.user.id}`, {
    method: 'POST',
    body: req.body
  });
  res.json(result);
});

// Hype Train
app.get('/api/hype-train', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/hypetrain/events?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

// Bans list
app.get('/api/mod/bans', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/moderation/banned?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

// Moderators
app.get('/api/mod/moderators', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/moderation/moderators?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

app.post('/api/mod/moderators', requireAuth, async (req, res) => {
  const { user_id } = req.body;
  const result = await twitchAPI(req, res, `/moderation/moderators?broadcaster_id=${req.auth.user.id}&user_id=${user_id}`, {
    method: 'POST'
  });
  res.json(result);
});

app.delete('/api/mod/moderators', requireAuth, async (req, res) => {
  const user_id = req.query.user_id || (req.body && req.body.user_id);
  const result = await twitchAPI(req, res, `/moderation/moderators?broadcaster_id=${req.auth.user.id}&user_id=${user_id}`, {
    method: 'DELETE'
  });
  res.json(result);
});

// VIPs
app.get('/api/mod/vips', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/channels/vips?broadcaster_id=${req.auth.user.id}&first=100`);
  res.json(result);
});

app.post('/api/mod/vips', requireAuth, async (req, res) => {
  const { user_id } = req.body;
  console.log('VIP ADD request:', { user_id, broadcaster_id: req.auth.user.id });
  const result = await twitchAPI(req, res, `/channels/vips?broadcaster_id=${req.auth.user.id}&user_id=${user_id}`, {
    method: 'POST'
  });
  console.log('VIP ADD result:', JSON.stringify(result));
  res.json(result);
});

app.delete('/api/mod/vips', requireAuth, async (req, res) => {
  const user_id = req.query.user_id || (req.body && req.body.user_id);
  const result = await twitchAPI(req, res, `/channels/vips?broadcaster_id=${req.auth.user.id}&user_id=${user_id}`, {
    method: 'DELETE'
  });
  res.json(result);
});

// All tags
app.get('/api/tags', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/tags/streams?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

// Send chat message
app.post('/api/chat/send', requireAuth, async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });
  const result = await twitchAPI(req, res, '/chat/messages', {
    method: 'POST',
    body: {
      broadcaster_id: req.auth.user.id,
      sender_id: req.auth.user.id,
      message: message.trim()
    }
  });
  res.json(result);
});

// Get chatters list with pagination
app.get('/api/mod/chatters/list', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/chat/chatters?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}&first=100`);
  res.json(result);
});

// ===== VIEWER HISTORY =====
app.post('/api/stats/viewer-sample', requireAuth, async (req, res) => {
  const now = Date.now();
  if (now - lastViewerSampleTime < 55000) return res.json({ status: 200, skipped: true });
  lastViewerSampleTime = now;

  const result = await twitchAPI(req, res, `/streams?user_id=${req.auth.user.id}`);
  if (result.status === 200 && result.data && result.data.data && result.data.data.length > 0) {
    const s = result.data.data[0];
    viewerHistory.push({ t: now, viewers: s.viewer_count, game: s.game_name, title: s.title });
    if (viewerHistory.length > 500) viewerHistory.shift();
  }
  res.json({ status: 200, count: viewerHistory.length });
});

app.get('/api/stats/viewer-history', requireAuth, (req, res) => {
  res.json({ data: viewerHistory });
});

// ===== STREAM ANALYSIS =====
app.get('/api/stats/stream-analysis', requireAuth, (req, res) => {
  const hourCounts = new Array(24).fill(0);
  const dayCounts = new Array(7).fill(0);
  const hours = ['12am','1am','2am','3am','4am','5am','6am','7am','8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm','9pm','10pm','11pm'];
  const days = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];

  viewerHistory.forEach(sample => {
    const d = new Date(sample.t);
    hourCounts[d.getHours()]++;
    dayCounts[d.getDay()]++;
  });

  const bestHour = hourCounts.indexOf(Math.max(...hourCounts));
  const bestDay = dayCounts.indexOf(Math.max(...dayCounts));

  res.json({
    data: {
      hourCounts, dayCounts, hours, days,
      bestHour: hours[bestHour], bestDay: days[bestDay],
      totalSamples: viewerHistory.length,
      peakViewers: viewerHistory.length > 0 ? Math.max(...viewerHistory.map(s => s.viewers)) : 0
    }
  });
});

// ===== FOLLOWER SNAPSHOTS =====
app.post('/api/stats/follower-snapshot', requireAuth, async (req, res) => {
  const now = Date.now();
  if (now - lastFollowerSampleTime < 300000) return res.json({ status: 200, skipped: true });
  lastFollowerSampleTime = now;

  const userResult = await twitchAPI(req, res, '/users?id=' + req.auth.user.id);
  if (userResult.status === 200 && userResult.data && userResult.data.data && userResult.data.data[0]) {
    const followerCount = userResult.data.data[0].followers_count || 0;
    followerSnapshots.push({ t: now, count: followerCount });
    if (followerSnapshots.length > 500) followerSnapshots.shift();
  }
  res.json({ status: 200 });
});

app.get('/api/stats/follower-history', requireAuth, (req, res) => {
  res.json({ data: followerSnapshots });
});

// ===== THUMBNAIL =====
app.put('/api/stream/thumbnail', requireAuth, async (req, res) => {
  const { image_url } = req.body;
  if (!image_url) return res.status(400).json({ error: 'image_url required' });
  const result = await twitchAPI(req, res, `/channels?broadcaster_id=${req.auth.user.id}`, {
    method: 'PATCH',
    body: { title: undefined, game_id: undefined, tags: undefined, is_live: undefined, language: undefined, tags_lock: undefined }
  });
  const thumbResult = await twitchAPI(req, res, '/channels/thumbnail', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: { broadcaster_id: req.auth.user.id, image_url }
  });
  res.json(thumbResult);
});

// ===== AUTO-MOD =====
app.get('/api/mod/automod/words', requireAuth, (req, res) => {
  res.json({ words: Array.from(bannedWords) });
});

app.post('/api/mod/automod/words', requireAuth, (req, res) => {
  const { words } = req.body;
  if (Array.isArray(words)) {
    words.forEach(w => bannedWords.add(w.toLowerCase().trim()));
  }
  res.json({ words: Array.from(bannedWords) });
});

app.delete('/api/mod/automod/words', requireAuth, (req, res) => {
  const { word } = req.body;
  if (word) bannedWords.delete(word.toLowerCase().trim());
  res.json({ words: Array.from(bannedWords) });
});

app.post('/api/mod/automod/check', requireAuth, (req, res) => {
  const { message } = req.body;
  if (!message) return res.json({ blocked: false });
  const lower = message.toLowerCase();
  for (const word of bannedWords) {
    if (lower.includes(word)) {
      return res.json({ blocked: true, word });
    }
  }
  res.json({ blocked: false });
});

// ===== ACTION LOG =====
app.get('/api/mod/action-log', requireAuth, (req, res) => {
  res.json({ data: actionLog.slice(-200).reverse() });
});

app.post('/api/mod/action-log', requireAuth, (req, res) => {
  const { action, target, details } = req.body;
  actionLog.push({
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    t: Date.now(),
    action: action || 'unknown',
    target: target || '',
    details: details || '',
    moderator: getModeratorName(req)
  });
  if (actionLog.length > 200) actionLog.shift();
  res.json({ status: 200 });
});

// ===== SHIELD MODE =====
app.get('/api/shield-mode', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/moderation/shield_mode?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}`);
  res.json(result);
});

app.put('/api/shield-mode', requireAuth, async (req, res) => {
  const { is_active } = req.body;
  const result = await twitchAPI(req, res, `/moderation/shield_mode?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}`, {
    method: 'PUT',
    body: { is_active: !!is_active }
  });
  res.json(result);
});

// ===== RAIDS =====
app.get('/api/raids/current', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/raids?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

app.post('/api/raids/start', requireAuth, async (req, res) => {
  const { to_broadcaster_id } = req.body;
  if (!to_broadcaster_id) return res.status(400).json({ error: 'to_broadcaster_id required' });
  const result = await twitchAPI(req, res, `/raids?from_broadcaster_id=${req.auth.user.id}&to_broadcaster_id=${to_broadcaster_id}`, {
    method: 'POST'
  });
  res.json(result);
});

app.delete('/api/raids/cancel', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/raids?broadcaster_id=${req.auth.user.id}`, {
    method: 'DELETE'
  });
  res.json(result);
});

app.get('/api/raids/search', requireAuth, async (req, res) => {
  const q = req.query.query;
  if (!q) return res.json({ data: [] });
  console.log('Raid search:', q);
  const result = await twitchAPI(req, res, `/search/channels?query=${encodeURIComponent(q)}&first=10`);
  console.log('Raid search result:', JSON.stringify(result).substring(0, 500));
  res.json(result);
});

// ===== CLIPS =====
app.get('/api/clips', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/clips?broadcaster_id=${req.auth.user.id}&first=20`);
  res.json(result);
});

app.post('/api/clips/create', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/clips?broadcaster_id=${req.auth.user.id}`, {
    method: 'POST'
  });
  res.json(result);
});

// ===== GOALS =====
app.get('/api/goals', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/goals?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

// ===== ADS =====
app.get('/api/ads/schedule', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/channels/ads?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

app.post('/api/ads/start', requireAuth, async (req, res) => {
  const { length } = req.body;
  const result = await twitchAPI(req, res, '/channels/commercial', {
    method: 'POST',
    body: { broadcaster_id: req.auth.user.id, length: length || 60 }
  });
  res.json(result);
});

app.post('/api/ads/snooze', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/channels/ads/schedule/snooze?broadcaster_id=${req.auth.user.id}`, {
    method: 'POST'
  });
  res.json(result);
});

// ===== POLLS HISTORY =====
app.get('/api/polls/history', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, res, `/polls?broadcaster_id=${req.auth.user.id}&first=20`);
  res.json(result);
});

// ===== LOCAL GOALS =====
const localGoals = [];
let goalIdCounter = 1;

app.get('/api/goals/local', requireAuth, (req, res) => {
  res.json({ data: localGoals });
});

app.post('/api/goals/local', requireAuth, (req, res) => {
  const { title, description, target, type } = req.body;
  if (!title || !target) return res.status(400).json({ error: 'title and target required' });
  const goal = {
    id: String(goalIdCounter++),
    title,
    description: description || '',
    target: parseInt(target),
    current: 0,
    type: type || 'custom',
    created_at: new Date().toISOString()
  };
  localGoals.push(goal);
  res.json({ data: goal });
});

app.patch('/api/goals/local/:id', requireAuth, (req, res) => {
  const goal = localGoals.find(g => g.id === req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  if (req.body.current !== undefined) goal.current = parseInt(req.body.current);
  if (req.body.target !== undefined) goal.target = parseInt(req.body.target);
  if (req.body.title) goal.title = req.body.title;
  if (req.body.description !== undefined) goal.description = req.body.description;
  res.json({ data: goal });
});

app.delete('/api/goals/local/:id', requireAuth, (req, res) => {
  const idx = localGoals.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Goal not found' });
  localGoals.splice(idx, 1);
  res.json({ status: 204 });
});

// ===== CHAT LOG =====
const chatLog = [];
app.get('/api/chat/log', requireAuth, (req, res) => {
  res.json({ data: chatLog.slice(-200) });
});

app.post('/api/chat/log', requireAuth, (req, res) => {
  const { user, message, color } = req.body;
  if (user && message) {
    chatLog.push({ user, message, color: color || '', timestamp: new Date().toISOString() });
    if (chatLog.length > 500) chatLog.shift();
  }
  res.json({ status: 200 });
});

// ===== TEAM CHAT (owner <-> moderators) =====
app.get('/api/team-chat/messages', requireAuth, (req, res) => {
  const channelId = req.auth.user.id;
  const after = req.query.after;
  let msgs = teamChatMessages.get(channelId) || [];
  if (after) {
    const afterTime = parseInt(after);
    if (!isNaN(afterTime)) {
      msgs = msgs.filter(m => m.timestamp > afterTime);
    }
  }
  res.json({ data: msgs.slice(-200) });
});

app.post('/api/team-chat/messages', requireAuth, (req, res) => {
  const channelId = req.auth.user.id;
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message required' });

  const senderRole = req.adminSession ? 'admin' : (req.moderatorSession ? 'moderator' : 'owner');
  const senderDisplay = req.adminSession ? req.adminSession.user : (req.moderatorSession ? req.moderatorSession.user : req.auth.user);
  const msg = {
    id: 'tc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    senderId: senderDisplay.id,
    senderName: senderDisplay.display_name || senderDisplay.login,
    senderLogin: senderDisplay.login || '',
    senderImage: senderDisplay.profile_image_url || '',
    senderRole: senderRole,
    message: message.trim().substring(0, 500),
    timestamp: Date.now()
  };

  let msgs = teamChatMessages.get(channelId) || [];
  msgs.push(msg);
  if (msgs.length > 500) msgs = msgs.slice(-500);
  teamChatMessages.set(channelId, msgs);

  // Save async (fire and forget)
  saveTeamChatToRedis().catch(() => {});

  res.json({ data: msg });
});

// ===== CHATTER TRACKING (for spam detector + top chatters) =====
const chatterMessages = [];
app.post('/api/stats/chatter-track', requireAuth, (req, res) => {
  const { user, message } = req.body;
  if (!user || !message) return res.status(400).json({ error: 'Missing user/message' });
  const now = Date.now();
  chatterMessages.push({ user, message, timestamp: now });
  if (chatterMessages.length > 2000) chatterMessages.shift();
  res.json({ status: 200 });
});

app.get('/api/stats/spam-check', requireAuth, (req, res) => {
  const { user, message, windowMs, maxSimilar } = req.body || {};
  const window = parseInt(windowMs) || 10000;
  const max = parseInt(maxSimilar) || 3;
  const now = Date.now();
  const recent = chatterMessages.filter(m =>
    m.user === user && m.timestamp > now - window
  );
  const isSpam = recent.length >= max;
  const similarCount = recent.filter(m =>
    levenshteinSimilarity(m.message, message) > 0.7
  ).length;
  res.json({ data: { isSpam, recentCount: recent.length, similarCount } });
});

function levenshteinSimilarity(a, b) {
  if (!a || !b) return 0;
  const la = a.length, lb = b.length;
  if (la === 0 && lb === 0) return 1;
  const matrix = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= la; i++)
    for (let j = 1; j <= lb; j++)
      matrix[i][j] = a[i-1] === b[j-1]
        ? matrix[i-1][j-1]
        : 1 + Math.min(matrix[i-1][j], matrix[i][j-1], matrix[i-1][j-1]);
  return 1 - matrix[la][lb] / Math.max(la, lb);
}

app.get('/api/stats/top-chatters', requireAuth, (req, res) => {
  const hours = parseInt(req.query.hours) || 1;
  const since = Date.now() - hours * 3600000;
  const counts = {};
  chatterMessages.filter(m => m.timestamp > since).forEach(m => {
    counts[m.user] = (counts[m.user] || 0) + 1;
  });
  const ranking = Object.entries(counts)
    .map(([user, messages]) => ({ user, messages }))
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 50);
  res.json({ data: ranking });
});

// ===== SPAM LOG =====
const spamLog = [];
app.post('/api/mod/spam-log', requireAuth, (req, res) => {
  const { user, message, action } = req.body;
  spamLog.push({ user, message, action, timestamp: new Date().toISOString() });
  if (spamLog.length > 200) spamLog.shift();
  res.json({ status: 200 });
});

app.get('/api/mod/spam-log', requireAuth, (req, res) => {
  res.json({ data: spamLog.slice(-100) });
});

// ===== MOD ACTIVITY =====
const modActions = [];
app.get('/api/mod/activity', requireAuth, (req, res) => {
  const today = new Date().toDateString();
  const todayActions = modActions.filter(a => new Date(a.timestamp).toDateString() === today);
  const modCounts = {};
  modActions.forEach(a => {
    modCounts[a.moderator] = (modCounts[a.moderator] || 0) + 1;
  });
  const leaderboard = Object.entries(modCounts)
    .map(([user, actions]) => ({ user, actions }))
    .sort((a, b) => b.actions - a.actions)
    .slice(0, 10);

  res.json({
    data: {
      totalActions: modActions.length,
      activeMods: Object.keys(modCounts).length,
      bansToday: todayActions.filter(a => a.type === 'ban').length,
      timeoutsToday: todayActions.filter(a => a.type === 'timeout').length,
      leaderboard,
      recentActions: modActions.slice(-50).reverse()
    }
  });
});

app.post('/api/mod/activity/log', requireAuth, (req, res) => {
  const { type, moderator, detail } = req.body;
  modActions.push({
    type: type || 'msg',
    moderator: moderator || req.auth.displayName || 'Mod',
    detail: detail || '',
    timestamp: new Date().toISOString()
  });
  if (modActions.length > 500) modActions.splice(0, modActions.length - 500);
  res.json({ status: 200 });
});

// ===== DASHBOARD SHARING =====
const sharedDashboards = new Map();
app.post('/api/share', requireAuth, (req, res) => {
  const token = 'share_' + Math.random().toString(36).slice(2, 10);
  sharedDashboards.set(token, {
    userId: req.auth.userId,
    userName: req.auth.displayName,
    createdAt: new Date().toISOString()
  });
  res.json({ data: { token, url: `/shared/${token}` } });
});

app.get('/api/share', requireAuth, (req, res) => {
  const shares = [];
  sharedDashboards.forEach((val, key) => {
    if (val.userId === req.auth.userId) shares.push({ token: key, ...val });
  });
  res.json({ data: shares });
});

app.delete('/api/share/:token', requireAuth, (req, res) => {
  const entry = sharedDashboards.get(req.params.token);
  if (!entry || entry.userId !== req.auth.userId) return res.status(404).json({ error: 'Not found' });
  sharedDashboards.delete(req.params.token);
  res.json({ status: 204 });
});

// ===== NIGHTBOT API =====
app.get('/api/nightbot/status', requireAuth, async (req, res) => {
  const channelId = req.auth.user.id;
  const nbData = nightbotTokens.get(channelId);
  if (!nbData) return res.json({ data: { connected: false } });
  const token = await getNightbotToken(channelId);
  if (!token) return res.json({ data: { connected: false } });

  // Check if Nightbot is joined to the channel
  let joined = false;
  try {
    const channelData = await nightbotApi(channelId, 'GET', '/channel');
    joined = channelData && channelData.channel && channelData.channel.joined === true;
  } catch (e) { /* ignore */ }

  res.json({
    data: {
      connected: true,
      joined,
      user: nbData.user || null,
      hasClientId: !!NIGHTBOT_CLIENT_ID
    }
  });
});

app.post('/api/nightbot/disconnect', requireAuth, async (req, res) => {
  const channelId = req.auth.user.id;
  nightbotTokens.delete(channelId);
  await saveToRedis();
  res.json({ status: 200 });
});

app.post('/api/nightbot/join', requireAuth, async (req, res) => {
  const channelId = req.auth.user.id;
  const data = await nightbotApi(channelId, 'POST', '/channel/join');
  res.json(data);
});

app.get('/api/nightbot/commands', requireAuth, async (req, res) => {
  const channelId = req.auth.user.id;
  const data = await nightbotApi(channelId, 'GET', '/commands');
  res.json(data);
});

app.post('/api/nightbot/commands', requireAuth, async (req, res) => {
  const channelId = req.auth.user.id;
  const { name, message, coolDown, userLevel } = req.body;
  if (!name || !message) return res.status(400).json({ error: 'Name and message required' });
  const data = await nightbotApi(channelId, 'POST', '/commands', {
    name: name.startsWith('!') ? name : `!${name}`,
    message,
    coolDown: String(coolDown || 5),
    userLevel: userLevel || 'everyone'
  });
  res.json(data);
});

app.put('/api/nightbot/commands/:id', requireAuth, async (req, res) => {
  const channelId = req.auth.user.id;
  const { name, message, coolDown, userLevel } = req.body;
  const body = {};
  if (name !== undefined) body.name = name.startsWith('!') ? name : `!${name}`;
  if (message !== undefined) body.message = message;
  if (coolDown !== undefined) body.coolDown = String(coolDown);
  if (userLevel !== undefined) body.userLevel = userLevel;
  const data = await nightbotApi(channelId, 'PUT', `/commands/${req.params.id}`, body);
  res.json(data);
});

app.delete('/api/nightbot/commands/:id', requireAuth, async (req, res) => {
  const channelId = req.auth.user.id;
  const data = await nightbotApi(channelId, 'DELETE', `/commands/${req.params.id}`);
  res.json(data);
});

app.get('/api/nightbot/commands/default', requireAuth, async (req, res) => {
  const channelId = req.auth.user.id;
  const data = await nightbotApi(channelId, 'GET', '/commands/default');
  res.json(data);
});

app.put('/api/nightbot/commands/default/:name', requireAuth, async (req, res) => {
  const channelId = req.auth.user.id;
  const { coolDown, enabled, userLevel } = req.body;
  const body = {};
  if (coolDown !== undefined) body.coolDown = String(coolDown);
  if (enabled !== undefined) body.enabled = String(enabled);
  if (userLevel !== undefined) body.userLevel = userLevel;
  const data = await nightbotApi(channelId, 'PUT', `/commands/default/${req.params.name}`, body);
  res.json(data);
});

// Nightbot sync: push all local commands to Nightbot
app.post('/api/nightbot/sync', requireAuth, async (req, res) => {
  const channelId = req.auth.user.id;

  // First, ensure Nightbot is joined to the channel
  try {
    await nightbotApi(channelId, 'POST', '/channel/join');
  } catch (e) { /* ignore, might already be joined */ }

  const localCmds = customCommands.get(channelId) || [];
  if (localCmds.length === 0) return res.json({ data: { synced: 0, errors: [] } });

  // Get existing Nightbot commands to avoid duplicates
  const existingNb = await nightbotApi(channelId, 'GET', '/commands');
  const existingNames = new Set((existingNb.commands || []).map(c => (c.name || '').replace(/^!/, '').toLowerCase()));

  const results = { synced: 0, updated: 0, skipped: 0, errors: [] };
  for (const cmd of localCmds) {
    try {
      const cmdName = `!${cmd.name}`;
      // Convert local variables to Nightbot format
      let nbMessage = cmd.response
        .replace(/{user}/g, '$(twitch $(user))')
        .replace(/{username}/g, '$(channel)')
        .replace(/{args}/g, '$(querystring)')
        .replace(/{date}/g, '$(date)')
        .replace(/{time}/g, '$(time)')
        .substring(0, 400);

      const body = {
        name: cmdName,
        message: nbMessage,
        coolDown: String(cmd.cooldown || 5),
        userLevel: cmd.permissions === 'broadcaster' ? 'owner' : cmd.permissions || 'everyone'
      };

      if (existingNames.has(cmd.name)) {
        // Find the existing command ID and update it
        const existingCmd = (existingNb.commands || []).find(c => (c.name || '').replace(/^!/, '').toLowerCase() === cmd.name);
        if (existingCmd) {
          await nightbotApi(channelId, 'PUT', `/commands/${existingCmd._id}`, body);
          results.updated++;
        }
      } else {
        const data = await nightbotApi(channelId, 'POST', '/commands', body);
        if (data && data.status === 200) {
          results.synced++;
        } else {
          results.errors.push({ name: cmd.name, error: data.message || 'Unknown error' });
        }
      }
    } catch (err) {
      results.errors.push({ name: cmd.name, error: err.message });
    }
  }
  res.json({ data: results });
});

// Nightbot import: pull all Nightbot commands into local
app.post('/api/nightbot/import', requireAuth, async (req, res) => {
  const channelId = req.auth.user.id;
  const data = await nightbotApi(channelId, 'GET', '/commands');
  if (!data || !data.commands) return res.json({ data: { imported: 0, errors: [] } });

  const localCmds = customCommands.get(channelId) || [];
  const results = { imported: 0, skipped: 0, errors: [] };

  for (const nbCmd of data.commands) {
    const cmdName = (nbCmd.name || '').replace(/^!/, '').trim().toLowerCase();
    if (!cmdName || !nbCmd.message) continue;
    if (localCmds.find(c => c.name === cmdName)) {
      results.skipped++;
      continue;
    }
    try {
      // Convert Nightbot variables to local format
      let response = nbCmd.message
        .replace(/\$\(twitch\s+\$\(user\)\)/g, '{user}')
        .replace(/\$\(channel\)/g, '{username}')
        .replace(/\$\(querystring\)/g, '{args}')
        .replace(/\$\(query\s+\d+\)/g, '{args}')
        .replace(/\$\(date\)/g, '{date}')
        .replace(/\$\(time\)/g, '{time}')
        .replace(/\$\(count\)/g, '{count}')
        .replace(/\$\(touser\)/g, '{user}');

      const permMap = { everyone: 'everyone', moderator: 'moderator', owner: 'broadcaster', regular: 'everyone', subscriber: 'everyone' };
      const cmd = {
        id: 'cmd_nb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: cmdName,
        response: response,
        enabled: true,
        cooldown: nbCmd.coolDown || 5,
        permissions: permMap[nbCmd.userLevel] || 'everyone',
        uses: nbCmd.count || 0,
        source: 'nightbot',
        createdAt: new Date().toISOString()
      };
      localCmds.push(cmd);
      results.imported++;
    } catch (err) {
      results.errors.push({ name: nbCmd.name, error: err.message });
    }
  }
  customCommands.set(channelId, localCmds);
  res.json({ data: results });
});

// ===== CUSTOM COMMANDS (server-side bot) =====

// Auto-sync helper: push a single command to Nightbot (fire-and-forget)
async function syncCommandToNightbot(channelId, cmd) {
  try {
    const token = await getNightbotToken(channelId);
    if (!token) return; // Nightbot not connected, skip

    let nbMessage = cmd.response
      .replace(/{user}/g, '$(twitch $(user))')
      .replace(/{username}/g, '$(channel)')
      .replace(/{args}/g, '$(querystring)')
      .replace(/{date}/g, '$(date)')
      .replace(/{time}/g, '$(time)')
      .substring(0, 400);

    const body = {
      name: `!${cmd.name}`,
      message: nbMessage,
      coolDown: String(cmd.cooldown || 5),
      userLevel: cmd.permissions === 'broadcaster' ? 'owner' : cmd.permissions || 'everyone'
    };

    // Check if command already exists on Nightbot
    const existing = await nightbotApi(channelId, 'GET', '/commands');
    const existingCmd = (existing.commands || []).find(c => (c.name || '').replace(/^!/, '').toLowerCase() === cmd.name);

    if (existingCmd) {
      await nightbotApi(channelId, 'PUT', `/commands/${existingCmd._id}`, body);
    } else {
      await nightbotApi(channelId, 'POST', '/commands', body);
    }
  } catch (e) {
    console.error('Nightbot auto-sync error:', e.message);
  }
}

// Auto-sync helper: remove a command from Nightbot
async function removeCommandFromNightbot(channelId, cmdName) {
  try {
    const token = await getNightbotToken(channelId);
    if (!token) return;

    const existing = await nightbotApi(channelId, 'GET', '/commands');
    const existingCmd = (existing.commands || []).find(c => (c.name || '').replace(/^!/, '').toLowerCase() === cmdName);
    if (existingCmd) {
      await nightbotApi(channelId, 'DELETE', `/commands/${existingCmd._id}`);
    }
  } catch (e) {
    console.error('Nightbot auto-delete error:', e.message);
  }
}

app.get('/api/commands', requireAuth, (req, res) => {
  const channelId = req.auth.user.id;
  const cmds = customCommands.get(channelId) || [];
  res.json({ data: cmds });
});

app.post('/api/commands', requireAuth, (req, res) => {
  const channelId = req.auth.user.id;
  const { name, response, enabled, cooldown, permissions } = req.body;
  if (!name || !response) return res.status(400).json({ error: 'Name and response required' });
  const cleanName = name.trim().toLowerCase().replace(/^!/, '');
  const cmds = customCommands.get(channelId) || [];
  if (cmds.find(c => c.name === cleanName)) return res.status(400).json({ error: 'Command already exists' });
  const cmd = {
    id: 'cmd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name: cleanName,
    response: response.trim(),
    enabled: enabled !== false,
    cooldown: Math.max(0, parseInt(cooldown) || 0),
    permissions: permissions || 'everyone',
    uses: 0,
    createdAt: new Date().toISOString()
  };
  cmds.push(cmd);
  customCommands.set(channelId, cmds);
  // Auto-sync to Nightbot (fire-and-forget)
  syncCommandToNightbot(channelId, cmd);
  res.json({ data: cmd });
});

app.put('/api/commands/:id', requireAuth, (req, res) => {
  const channelId = req.auth.user.id;
  const cmds = customCommands.get(channelId) || [];
  const cmd = cmds.find(c => c.id === req.params.id);
  if (!cmd) return res.status(404).json({ error: 'Command not found' });
  const { name, response, enabled, cooldown, permissions } = req.body;
  if (name !== undefined) cmd.name = name.trim().toLowerCase().replace(/^!/, '');
  if (response !== undefined) cmd.response = response.trim();
  if (enabled !== undefined) cmd.enabled = enabled;
  if (cooldown !== undefined) cmd.cooldown = Math.max(0, parseInt(cooldown) || 0);
  if (permissions !== undefined) cmd.permissions = permissions;
  customCommands.set(channelId, cmds);
  // Auto-sync to Nightbot (fire-and-forget)
  syncCommandToNightbot(channelId, cmd);
  res.json({ data: cmd });
});

app.delete('/api/commands/:id', requireAuth, (req, res) => {
  const channelId = req.auth.user.id;
  const cmds = customCommands.get(channelId) || [];
  const idx = cmds.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Command not found' });
  const deletedName = cmds[idx].name;
  cmds.splice(idx, 1);
  customCommands.set(channelId, cmds);
  // Auto-sync to Nightbot: remove command (fire-and-forget)
  removeCommandFromNightbot(channelId, deletedName);
  res.json({ status: 204 });
});

// Chat message handler for bot commands
async function handleChatMessage(broadcasterId, senderId, senderLogin, senderName, message, userRoles) {
  const cmds = customCommands.get(broadcasterId) || [];
  const cleanMsg = message.trim();
  if (!cleanMsg.startsWith('!')) return;

  const parts = cleanMsg.slice(1).split(/\s+/);
  const cmdName = parts[0].toLowerCase();
  const cmd = cmds.find(c => c.name === cmdName && c.enabled);
  if (!cmd) return;

  // Cooldown check
  const cooldownKey = `${broadcasterId}:${cmdName}:${senderId}`;
  const lastUsed = commandCooldowns.get(cooldownKey) || 0;
  const now = Date.now();
  if (cmd.cooldown > 0 && (now - lastUsed) < cmd.cooldown * 1000) return;
  commandCooldowns.set(cooldownKey, now);

  // Permission check
  const isBroadcaster = senderId === broadcasterId;
  const isMod = userRoles && (userRoles.includes('moderator') || userRoles.includes('broadcaster'));
  if (cmd.permissions === 'broadcaster' && !isBroadcaster) return;
  if (cmd.permissions === 'moderator' && !isMod && !isBroadcaster) return;

  // Build response with variables
  const args = parts.slice(1).join(' ');
  let response = cmd.response
    .replace(/{user}/g, senderName)
    .replace(/{username}/g, senderLogin)
    .replace(/{args}/g, args)
    .replace(/{channel}/g, broadcasterId)
    .replace(/{date}/g, new Date().toLocaleDateString('es'))
    .replace(/{time}/g, new Date().toLocaleTimeString('es'));

  cmd.uses = (cmd.uses || 0) + 1;

  // Send response via Twitch API
  try {
    const ownerData = ownerTokens.get(broadcasterId);
    if (!ownerData) return;
    await fetch('https://api.twitch.tv/helix/chat/messages', {
      method: 'POST',
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${ownerData.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        broadcaster_id: broadcasterId,
        sender_id: broadcasterId,
        message: response
      })
    });
  } catch (err) {
    console.error('Bot command send error:', err.message);
  }
}

// ===== EVENTSUB WEBSOCKET =====
function connectEventSub(broadcasterId, accessToken) {
  if (eventsubWs) disconnectEventSub();
  eventsubBroadcasterId = broadcasterId;

  const ws = new (require('ws'))('wss://eventsub.wss.twitch.tv/ws');
  eventsubWs = ws;

  ws.on('message', async (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.metadata?.message_type === 'session_welcome') {
      eventsubSessionId = msg.payload.session.id;
      eventsubConnected = true;
      const keepaliveMs = msg.payload.session.keepalive_timeout_seconds * 1000 * 0.8;
      eventsubKeepalive = setInterval(() => {
        if (ws.readyState === 1) ws.ping();
      }, keepaliveMs);
      // Subscribe to channel.chat.message
      await subscribeEventSub(broadcasterId, accessToken);
    }
    if (msg.metadata?.message_type === 'notification' && msg.metadata?.subscription_type === 'channel.chat.message') {
      const e = msg.payload.event;
      await handleChatMessage(
        e.broadcaster_user_id,
        e.chatter_user_id,
        e.chatter_user_login,
        e.chatter_user_name,
        e.message.text,
        e.badges ? e.badges.map(b => b.set_id) : []
      );
    }
    if (msg.metadata?.message_type === 'session_reconnect') {
      const newUrl = msg.payload.session.reconnect_url;
      if (newUrl) {
        disconnectEventSub();
        const newWs = new (require('ws'))(newUrl);
        newWs.on('message', ws.onmessage);
        eventsubWs = newWs;
      }
    }
  });

  ws.on('close', () => {
    eventsubConnected = false;
    clearInterval(eventsubKeepalive);
    eventsubSessionId = null;
  });

  ws.on('error', (err) => {
    console.error('EventSub WebSocket error:', err.message);
    eventsubConnected = false;
  });
}

async function subscribeEventSub(broadcasterId, accessToken) {
  if (!eventsubSessionId) return;
  try {
    await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'channel.chat.message',
        version: '1',
        condition: { broadcaster_user_id: broadcasterId, user_id: broadcasterId },
        transport: { method: 'websocket', session_id: eventsubSessionId }
      })
    });
  } catch (err) {
    console.error('EventSub subscribe error:', err.message);
  }
}

function disconnectEventSub() {
  clearInterval(eventsubKeepalive);
  if (eventsubWs) { try { eventsubWs.close(); } catch {} }
  eventsubWs = null;
  eventsubSessionId = null;
  eventsubConnected = false;
  eventsubBroadcasterId = null;
}

app.post('/api/commands/eventsub/connect', requireAuth, async (req, res) => {
  connectEventSub(req.auth.user.id, req.auth.accessToken);
  res.json({ status: 'connecting' });
});

app.post('/api/commands/eventsub/disconnect', requireAuth, (req, res) => {
  disconnectEventSub();
  res.json({ status: 'disconnected' });
});

app.get('/api/commands/eventsub/status', requireAuth, (req, res) => {
  res.json({ data: { connected: eventsubConnected, sessionId: eventsubSessionId || null, broadcasterId: eventsubBroadcasterId } });
});

// ===== ALERT TEMPLATES =====
app.get('/api/alerts/templates', requireAuth, (req, res) => {
  const channelId = req.auth.user.id;
  const templates = alertTemplates.get(channelId) || {
    follow: { message: '{user} te ha seguido!', duration: 5, sound: 'follow' },
    sub: { message: '{user} se ha suscrito! ({tier})', duration: 7, sound: 'sub' },
    bits: { message: '{user} ha enviado {amount} bits!', duration: 5, sound: 'bits' },
    raid: { message: '{user} ha raideado con {amount} espectadores!', duration: 7, sound: 'raid' }
  };
  res.json({ data: templates });
});

app.put('/api/alerts/templates', requireAuth, (req, res) => {
  const channelId = req.auth.user.id;
  const templates = req.body;
  if (!templates || typeof templates !== 'object') return res.status(400).json({ error: 'Templates object required' });
  alertTemplates.set(channelId, templates);
  res.json({ data: templates });
});

app.post('/api/alerts/push-custom', requireAuth, (req, res) => {
  const { type, user, detail, amount, game } = req.body;
  if (!type) return res.status(400).json({ error: 'type required' });
  const channelId = req.auth.user.id;
  const templates = alertTemplates.get(channelId) || {};
  const tmpl = templates[type] || {};
  const message = (tmpl.message || '{user} - {type}')
    .replace(/{user}/g, user || 'User')
    .replace(/{username}/g, user || 'user')
    .replace(/{type}/g, type)
    .replace(/{amount}/g, amount || '')
    .replace(/{game}/g, game || '')
    .replace(/{detail}/g, detail || '');
  const alert = {
    id: 'al_' + Date.now(),
    type,
    user: user || '',
    detail: detail || '',
    amount: amount || null,
    game: game || null,
    message,
    duration: tmpl.duration || 5,
    sound: tmpl.sound || type,
    timestamp: new Date().toISOString()
  };
  liveAlerts.push(alert);
  if (liveAlerts.length > 100) liveAlerts.shift();
  res.json({ data: alert });
});

// ===== EMAIL DIGEST =====
app.get('/api/email/config', requireAuth, (req, res) => {
  const channelId = req.auth.user.id;
  const config = emailConfigs.get(channelId) || { email: '', smtpHost: 'smtp.gmail.com', smtpPort: 587, smtpUser: '', enabled: false };
  res.json({ data: { ...config, smtpPass: config.smtpPass ? '***' : '' } });
});

app.put('/api/email/config', requireAuth, (req, res) => {
  const channelId = req.auth.user.id;
  const { email, smtpHost, smtpPort, smtpUser, smtpPass, enabled } = req.body;
  const existing = emailConfigs.get(channelId) || {};
  const config = {
    email: email || existing.email || '',
    smtpHost: smtpHost || existing.smtpHost || 'smtp.gmail.com',
    smtpPort: parseInt(smtpPort) || existing.smtpPort || 587,
    smtpUser: smtpUser || existing.smtpUser || '',
    smtpPass: smtpPass && smtpPass !== '***' ? smtpPass : existing.smtpPass || '',
    enabled: enabled !== undefined ? enabled : existing.enabled || false,
    lastSent: existing.lastSent || null
  };
  emailConfigs.set(channelId, config);
  res.json({ data: { ...config, smtpPass: config.smtpPass ? '***' : '' } });
});

app.post('/api/email/test', requireAuth, async (req, res) => {
  const channelId = req.auth.user.id;
  const config = emailConfigs.get(channelId);
  if (!config || !config.email || !config.smtpPass) {
    return res.status(400).json({ error: 'Email no configurado' });
  }
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass }
    });
    await transporter.sendMail({
      from: config.smtpUser,
      to: config.email,
      subject: 'TwitchMod Dashboard - Test de Email Digest',
      html: '<h2>Email digest configurado correctamente</h2><p>Recibiras resumenes semanales de tu canal de Twitch.</p>'
    });
    res.json({ data: { sent: true } });
  } catch (err) {
    res.status(500).json({ error: 'Error al enviar: ' + err.message });
  }
});

app.post('/api/email/send-digest', requireAuth, async (req, res) => {
  const channelId = req.auth.user.id;
  const config = emailConfigs.get(channelId);
  if (!config || !config.email || !config.smtpPass) {
    return res.status(400).json({ error: 'Email no configurado' });
  }

  // Gather weekly metrics
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 3600000;
  const recentViewers = viewerHistory.filter(v => v.t > weekAgo);
  const recentFollowers = followerSnapshots.filter(f => f.t > weekAgo);
  const recentActions = actionLog.filter(a => a.timestamp && new Date(a.timestamp).getTime() > weekAgo);
  const recentChatterCount = chatterMessages.filter(m => m.timestamp > weekAgo);

  const avgViewers = recentViewers.length > 0
    ? Math.round(recentViewers.reduce((s, v) => s + v.viewers, 0) / recentViewers.length)
    : 0;
  const peakViewers = recentViewers.length > 0
    ? Math.max(...recentViewers.map(v => v.viewers))
    : 0;
  const peakGame = recentViewers.length > 0
    ? recentViewers.reduce((best, v) => (v.viewers > (best.viewers || 0) ? v : best), {}).game || '--'
    : '--';
  const uniqueChatters = new Set(recentChatterCount.map(m => m.user)).size;

  const user = req.auth.user;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#1a1125;color:#e0d4f5;padding:32px;border-radius:12px">
      <h1 style="color:#a855f7;text-align:center">Resumen Semanal</h1>
      <p style="text-align:center;color:#9585c0">Canal: <strong>${user.display_name}</strong></p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:24px 0">
        <div style="background:#2a1f3d;padding:16px;border-radius:8px;text-align:center">
          <div style="font-size:28px;font-weight:700;color:#a855f7">${avgViewers}</div>
          <div style="color:#9585c0;font-size:14px">Viewers promedio</div>
        </div>
        <div style="background:#2a1f3d;padding:16px;border-radius:8px;text-align:center">
          <div style="font-size:28px;font-weight:700;color:#ec4899">${peakViewers}</div>
          <div style="color:#9585c0;font-size:14px">Peak viewers</div>
        </div>
        <div style="background:#2a1f3d;padding:16px;border-radius:8px;text-align:center">
          <div style="font-size:28px;font-weight:700;color:#10b981">${recentFollowers.length}</div>
          <div style="color:#9585c0;font-size:14px">Nuevos seguidores</div>
        </div>
        <div style="background:#2a1f3d;padding:16px;border-radius:8px;text-align:center">
          <div style="font-size:28px;font-weight:700;color:#f59e0b">${uniqueChatters}</div>
          <div style="color:#9585c0;font-size:14px">Chatters unicos</div>
        </div>
      </div>
      <p style="color:#9585c0;font-size:14px;text-align:center">Juego mas jugado: <strong style="color:#e0d4f5">${peakGame}</strong></p>
      <hr style="border-color:#2a1f3d;margin:24px 0">
      <p style="color:#5a4d7a;font-size:12px;text-align:center">TwitchMod Dashboard - Resumen automatico semanal</p>
    </div>`;

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass }
    });
    await transporter.sendMail({
      from: config.smtpUser,
      to: config.email,
      subject: `Resumen Semanal - ${user.display_name}`,
      html
    });
    config.lastSent = new Date().toISOString();
    emailConfigs.set(channelId, config);
    res.json({ data: { sent: true, lastSent: config.lastSent } });
  } catch (err) {
    res.status(500).json({ error: 'Error al enviar: ' + err.message });
  }
});

// ===== ALERTS WIDGET =====
const liveAlerts = [];
app.get('/api/alerts/recent', requireAuth, (req, res) => {
  res.json({ data: liveAlerts.slice(-20) });
});

app.post('/api/alerts/push', requireAuth, (req, res) => {
  const { type, user, detail } = req.body;
  if (!type) return res.status(400).json({ error: 'type required' });
  const alert = { id: 'al_' + Date.now(), type, user: user || '', detail: detail || '', timestamp: new Date().toISOString() };
  liveAlerts.push(alert);
  if (liveAlerts.length > 100) liveAlerts.shift();
  res.json({ data: alert });
});

// ===== APPEALS SYSTEM =====
const APPEALS_KEY = 'fav-twitch:appeals';

async function getAppeals() {
  if (!REDIS_URL) return [];
  try {
    const raw = await redisGet(APPEALS_KEY);
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function saveAppeals(appeals) {
  if (!REDIS_URL) { console.error('No REDIS_URL, appeals not saved'); return false; }
  try { await redisSet(APPEALS_KEY, appeals); return true; } catch (err) { console.error('Failed to save appeals:', err.message); return false; }
}

app.post('/api/appeals', async (req, res) => {
  const { channelName, bannedUser, banReason, appealMessage } = req.body;
  if (!channelName || !bannedUser || !appealMessage) {
    return res.status(400).json({ error: 'Canal, usuario y mensaje requeridos' });
  }
  const appeals = await getAppeals();
  const appeal = {
    id: 'app_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    channelName: channelName.toLowerCase().trim(),
    bannedUser: bannedUser.trim(),
    banReason: (banReason || '').trim(),
    appealMessage: appealMessage.trim(),
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  appeals.push(appeal);
  const saved = await saveAppeals(appeals);
  if (!saved) return res.status(500).json({ error: 'Error al guardar en base de datos' });
  res.json({ data: { id: appeal.id, status: 'pending' } });
});

app.get('/api/owner/appeals', requireAuth, async (req, res) => {
  const appeals = await getAppeals();
  res.json({ data: appeals });
});

app.post('/api/owner/appeals/:id/review', requireAuth, async (req, res) => {
  const { action } = req.body;
  if (!action || !['approved', 'denied'].includes(action)) {
    return res.status(400).json({ error: 'action must be approved or denied' });
  }
  const appeals = await getAppeals();
  const appeal = appeals.find(a => a.id === req.params.id);
  if (!appeal) return res.status(404).json({ error: 'Appeal not found' });
  appeal.status = action;
  appeal.reviewedBy = req.auth.user.login;
  appeal.reviewedAt = new Date().toISOString();
  await saveAppeals(appeals);
  res.json({ data: appeal });
});

// Dashboard SPA fallback
app.get('/channels', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/appeal', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/changelog', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Vercel: export app, skip listen
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Twitch Moderator Dashboard running at http://localhost:${PORT}`);
  });
}

module.exports = app;
