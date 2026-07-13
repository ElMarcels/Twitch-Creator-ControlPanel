require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
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
    body: JSON.stringify({ value: JSON.stringify(value) })
  });
  if (!resp.ok) throw new Error(`Redis SET failed: ${resp.status}`);
}

const moderatorAccounts = new Map();
const ownerTokens = new Map();

async function loadFromRedis() {
  if (!REDIS_URL) return;
  try {
    const [tokensRaw, accountsRaw] = await Promise.all([
      redisGet('fav-twitch:ownerTokens'),
      redisGet('fav-twitch:moderatorAccounts')
    ]);
    const tokens = typeof tokensRaw === 'string' ? JSON.parse(tokensRaw) : tokensRaw;
    const accounts = typeof accountsRaw === 'string' ? JSON.parse(accountsRaw) : accountsRaw;
    ownerTokens.clear();
    moderatorAccounts.clear();
    if (tokens && typeof tokens === 'object') Object.entries(tokens).forEach(([k, v]) => ownerTokens.set(k, v));
    if (accounts && typeof accounts === 'object') Object.entries(accounts).forEach(([k, v]) => moderatorAccounts.set(k, v));
  } catch (err) {
    console.error('Failed to load from Redis:', err.message);
  }
}

async function saveToRedis() {
  if (!REDIS_URL) return;
  const obj = { ownerTokens: {}, moderatorAccounts: {} };
  ownerTokens.forEach((v, k) => obj.ownerTokens[k] = v);
  moderatorAccounts.forEach((v, k) => obj.moderatorAccounts[k] = v);
  try {
    await Promise.all([
      redisSet('fav-twitch:ownerTokens', obj.ownerTokens),
      redisSet('fav-twitch:moderatorAccounts', obj.moderatorAccounts)
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
    if (decoded.role === 'moderator' && decoded.selectedChannelId) {
      const ownerData = ownerTokens.get(decoded.selectedChannelId);
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
        setAuthCookie(res, refreshed);
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

app.get('/auth/me', (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  const decoded = token ? verifyToken(token) : null;
  if (!decoded) {
    return res.json({ authenticated: false });
  }
  if (decoded.user) {
    return res.json({
      authenticated: true,
      user: decoded.user,
      role: decoded.role || null,
      selectedChannelId: decoded.selectedChannelId || null
    });
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
  console.log(`[moderated-channels] Checking for user ${myUserId} (${req.auth.user.login})`);
  console.log(`[moderated-channels] moderatorAccounts size: ${moderatorAccounts.size}`);
  moderatorAccounts.forEach((val, key) => {
    console.log(`[moderated-channels]   key=${key} owner=${val.ownerId} twitchUser=${val.twitchUserId}`);
  });
  const result = await twitchAPI(req, res, `/moderation/channels?user_id=${myUserId}`);
  console.log(`[moderated-channels] Twitch API status: ${result.status}`);
  if (result.status !== 200 || !result.data) {
    console.log(`[moderated-channels] Twitch API error:`, JSON.stringify(result.data));
    return res.json({ data: [] });
  }
  const channels = result.data.data || [];
  console.log(`[moderated-channels] Twitch returned ${channels.length} channels:`, channels.map(c => c.broadcaster_login));
  const dashboardChannels = [];
  for (const ch of channels) {
    const key = `${ch.broadcaster_id}:${myUserId}`;
    const found = moderatorAccounts.has(key);
    console.log(`[moderated-channels]   checking key=${key} found=${found}`);
    if (found) {
      dashboardChannels.push(ch);
    }
  }
  console.log(`[moderated-channels] Returning ${dashboardChannels.length} dashboard channels`);
  res.json({ data: dashboardChannels });
});

app.get('/api/channel/verify', requireAuth, (req, res) => {
  const channelId = req.query.channel_id;
  if (!channelId) return res.status(400).json({ error: 'channel_id required' });
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

app.post('/auth/select-channel', requireAuth, (req, res) => {
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ error: 'channelId required' });
  let role = 'owner';
  if (channelId !== req.auth.user.id) {
    const key = `${channelId}:${req.auth.user.id}`;
    if (!moderatorAccounts.has(key)) {
      return res.status(403).json({ error: 'Not authorized for this channel' });
    }
    role = 'moderator';
  }
  const token = req.cookies[COOKIE_NAME];
  const decoded = token ? verifyToken(token) : null;
  if (!decoded) return res.status(401).json({ error: 'Not authenticated' });
  const selectedToken = signToken({
    user: decoded.user,
    accessToken: decoded.accessToken,
    refreshToken: decoded.refreshToken,
    selectedChannelId: channelId,
    role: role
  });
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

// Vercel: export app, skip listen
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Twitch Moderator Dashboard running at http://localhost:${PORT}`);
  });
}

module.exports = app;
