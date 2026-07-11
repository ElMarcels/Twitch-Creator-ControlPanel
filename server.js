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
const BASE_URL = process.env.BASE_URL || process.env.VERCEL_URL || `http://localhost:${PORT}`;
const COOKIE_NAME = 'tw_auth';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const SCOPES = [
  'user:read:email',
  'channel:moderate',
  'chat:edit',
  'chat:read',
  'moderator:manage:banned_users',
  'moderator:read:chatters',
  'moderator:manage:announcements',
  'moderator:manage:chat_settings',
  'moderator:read:followers',
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
  'user:edit:follows',
  'user:read:broadcast',
  'user:edit:broadcast',
  'moderation:read',
  'bits:read'
].join(' ');

app.use(cookieParser());
app.use(express.json());
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

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  const decoded = token ? verifyToken(token) : null;
  if (decoded) {
    req.auth = decoded;
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

async function twitchAPI(req, endpoint, options = {}) {
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
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Auth error:', err);
    res.redirect('/?error=auth_failed');
  }
});

app.get('/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.redirect('/');
});

app.get('/auth/me', (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  const decoded = token ? verifyToken(token) : null;
  if (decoded && decoded.user) {
    res.json({ authenticated: true, user: decoded.user });
  } else {
    res.json({ authenticated: false });
  }
});

// User info
app.get('/api/user', requireAuth, async (req, res) => {
  res.json(req.auth.user);
});

// Moderation
app.get('/api/mod/chatters', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/chat/chatters?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}`);
  res.json(result);
});

app.post('/api/mod/ban', requireAuth, async (req, res) => {
  const { user_id, reason, duration } = req.body;
  const body = { data: { user_id, reason: reason || '' } };
  if (duration) body.data.duration = duration;
  const result = await twitchAPI(req, `/moderation/bans?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}`, {
    method: 'POST',
    body
  });
  res.json(result);
});

app.delete('/api/mod/unban', requireAuth, async (req, res) => {
  const { user_id } = req.body;
  const result = await twitchAPI(req, `/moderation/bans?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}&user_id=${user_id}`, {
    method: 'DELETE'
  });
  res.json(result);
});

app.post('/api/mod/timeout', requireAuth, async (req, res) => {
  const { user_id, duration, reason } = req.body;
  const result = await twitchAPI(req, `/moderation/bans?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}`, {
    method: 'POST',
    body: { data: { user_id, duration: duration || 600, reason: reason || 'Timeout' } }
  });
  res.json(result);
});

app.post('/api/mod/untimeout', requireAuth, async (req, res) => {
  const { user_id } = req.body;
  const result = await twitchAPI(req, `/moderation/bans?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}&user_id=${user_id}`, {
    method: 'DELETE'
  });
  res.json(result);
});

app.post('/api/mod/announce', requireAuth, async (req, res) => {
  const { message, color } = req.body;
  const result = await twitchAPI(req, `/chat/announcements?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}`, {
    method: 'POST',
    body: { message, color: color || 'primary' }
  });
  res.json(result);
});

// Followers (with profile images via /users)
app.get('/api/mod/followers', requireAuth, async (req, res) => {
  try {
    const result = await twitchAPI(req, `/channels/followers?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}&first=100`);
    if (result.status !== 200 || !result.data || !result.data.data) {
      return res.json({ status: result.status, data: { data: [], error: result.data } });
    }
    const followerIds = result.data.data.map(f => f.user_id);
    if (followerIds.length > 0) {
      const profileMap = {};
      for (let i = 0; i < followerIds.length; i += 100) {
        const chunk = followerIds.slice(i, i + 100);
        const idsParam = chunk.map(id => `id=${id}`).join('&');
        const usersResult = await twitchAPI(req, `/users?${idsParam}`);
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
    res.json(result);
  } catch (err) {
    res.json({ status: 500, data: { data: [], error: err.message } });
  }
});

// Search users by login
app.get('/api/users/search', requireAuth, async (req, res) => {
  const { login } = req.query;
  if (!login) return res.json({ data: [] });
  const result = await twitchAPI(req, `/users?login=${login}`);
  res.json(result);
});

// Channel Points
app.get('/api/channel-points/rewards', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/channel_points/custom_rewards?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

app.post('/api/channel-points/rewards', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/channel_points/custom_rewards?broadcaster_id=${req.auth.user.id}`, {
    method: 'POST',
    body: req.body
  });
  res.json(result);
});

app.patch('/api/channel-points/rewards/:rewardId', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/channel_points/custom_rewards?broadcaster_id=${req.auth.user.id}&id=${req.params.rewardId}`, {
    method: 'PATCH',
    body: req.body
  });
  res.json(result);
});

app.delete('/api/channel-points/rewards/:rewardId', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/channel_points/custom_rewards?broadcaster_id=${req.auth.user.id}&id=${req.params.rewardId}`, {
    method: 'DELETE'
  });
  res.json(result);
});

app.get('/api/channel-points/rewards/:rewardId/redemptions', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/channel_points/custom_rewards/redemptions?broadcaster_id=${req.auth.user.id}&reward_id=${req.params.rewardId}&status=${req.query.status || 'UNFULFILLED'}`);
  res.json(result);
});

app.patch('/api/channel-points/rewards/:rewardId/redemptions', requireAuth, async (req, res) => {
  const { ids, status } = req.body;
  const idsParam = ids.map(id => `id=${id}`).join('&');
  const result = await twitchAPI(req, `/channel_points/custom_rewards/redemptions?broadcaster_id=${req.auth.user.id}&reward_id=${req.params.rewardId}&${idsParam}`, {
    method: 'PATCH',
    body: { status }
  });
  res.json(result);
});

// Stream info
app.get('/api/stream', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/streams?user_id=${req.auth.user.id}`);
  res.json(result);
});

app.get('/api/stream/tags', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/tags/streams?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

app.get('/api/categories/search', requireAuth, async (req, res) => {
  const { name } = req.query;
  if (!name) return res.json({ data: [] });
  const result = await twitchAPI(req, `/search/categories?query=${encodeURIComponent(name)}`);
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

  const result = await twitchAPI(req, `/channels?broadcaster_id=${req.auth.user.id}`, {
    method: 'PATCH',
    body
  });
  res.json(result);
});

app.get('/api/channel', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/channels?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

// Chat settings
app.get('/api/chat/settings', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/chat/settings?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}`);
  res.json(result);
});

app.patch('/api/chat/settings', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/chat/settings?broadcaster_id=${req.auth.user.id}&moderator_id=${req.auth.user.id}`, {
    method: 'PATCH',
    body: req.body
  });
  res.json(result);
});

// Emotes
app.get('/api/emotes/global', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, '/emotes/global');
  res.json(result);
});

// Predictions
app.get('/api/predictions', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/predictions?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

app.post('/api/predictions', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, '/predictions', {
    method: 'POST',
    body: { ...req.body, broadcaster_id: req.auth.user.id }
  });
  res.json(result);
});

app.patch('/api/predictions/:predictionId', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, '/predictions', {
    method: 'PATCH',
    body: { ...req.body, broadcaster_id: req.auth.user.id }
  });
  res.json(result);
});

// Polls
app.get('/api/polls', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/polls?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

app.post('/api/polls', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, '/polls', {
    method: 'POST',
    body: { ...req.body, broadcaster_id: req.auth.user.id }
  });
  res.json(result);
});

app.patch('/api/polls/:pollId', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, '/polls', {
    method: 'PATCH',
    body: { ...req.body, broadcaster_id: req.auth.user.id, id: req.params.pollId }
  });
  res.json(result);
});

// Raids
app.post('/api/raids/start', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/raids?from_broadcaster_id=${req.auth.user.id}`, {
    method: 'POST',
    body: req.body
  });
  res.json(result);
});

app.delete('/api/raids/cancel', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/raids?from_broadcaster_id=${req.auth.user.id}`, {
    method: 'DELETE'
  });
  res.json(result);
});

// Hype Train
app.get('/api/hype-train', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/hypetrain/events?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

// Bans list
app.get('/api/mod/bans', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/moderation/banned?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

// Moderators
app.get('/api/mod/moderators', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/moderation/moderators?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

app.post('/api/mod/moderators', requireAuth, async (req, res) => {
  const { user_id } = req.body;
  const result = await twitchAPI(req, `/moderation/moderators?broadcaster_id=${req.auth.user.id}&user_id=${user_id}`, {
    method: 'POST'
  });
  res.json(result);
});

app.delete('/api/mod/moderators', requireAuth, async (req, res) => {
  const { user_id } = req.body;
  const result = await twitchAPI(req, `/moderation/moderators?broadcaster_id=${req.auth.user.id}&user_id=${user_id}`, {
    method: 'DELETE'
  });
  res.json(result);
});

// VIPs
app.get('/api/mod/vips', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/channels/vips?broadcaster_id=${req.auth.user.id}&first=100`);
  res.json(result);
});

app.post('/api/mod/vips', requireAuth, async (req, res) => {
  const { user_id } = req.body;
  const result = await twitchAPI(req, `/channels/vips?broadcaster_id=${req.auth.user.id}`, {
    method: 'PUT',
    body: { data: { user_id } }
  });
  res.json(result);
});

app.delete('/api/mod/vips', requireAuth, async (req, res) => {
  const { user_id } = req.body;
  const result = await twitchAPI(req, `/channels/vips?broadcaster_id=${req.auth.user.id}&user_id=${user_id}`, {
    method: 'DELETE'
  });
  res.json(result);
});

// All tags
app.get('/api/tags', requireAuth, async (req, res) => {
  const result = await twitchAPI(req, `/tags/streams?broadcaster_id=${req.auth.user.id}`);
  res.json(result);
});

// Dashboard SPA fallback
app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Vercel: export app, skip listen
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Twitch Moderator Dashboard running at http://localhost:${PORT}`);
  });
}

module.exports = app;
