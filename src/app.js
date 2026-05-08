const express = require('express');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const AUTHFLOW_BASE_URL = (process.env.AUTHFLOW_BASE_URL || 'https://api.authflow.net').replace(/\/$/, '');
const AUTHFLOW_API_KEY = process.env.AUTHFLOW_API_KEY || '';

const API_KEY_ENDPOINTS = new Set([
  '/auth/fooBar',
  '/auth/signUp',
  '/auth/login',
  '/auth/resend-verify-email',
  '/auth/forgot-password',
]);

function normalizeQuery(reqQuery) {
  const query = {};
  for (const [key, value] of Object.entries(reqQuery || {})) {
    if (Array.isArray(value)) {
      query[key] = value[value.length - 1];
      continue;
    }
    query[key] = value;
  }
  return query;
}

function maybeInjectApiKey(pathname, query, body) {
  if (!API_KEY_ENDPOINTS.has(pathname) || !AUTHFLOW_API_KEY) {
    return { query, body };
  }

  const nextQuery = { ...query };
  const nextBody = body && typeof body === 'object' ? { ...body } : body;

  if (nextQuery && !nextQuery.api_key) {
    nextQuery.api_key = AUTHFLOW_API_KEY;
  }

  if (nextBody && typeof nextBody === 'object' && !nextBody.api_key) {
    nextBody.api_key = AUTHFLOW_API_KEY;
  }

  return { query: nextQuery, body: nextBody };
}

function buildUpstreamUrl(pathname, query) {
  const url = new URL(`${AUTHFLOW_BASE_URL}${pathname}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    url.searchParams.set(key, String(value));
  }
  return url;
}

function pickForwardHeaders(req) {
  const headers = {};
  const authHeader = req.get('authorization');
  if (authHeader) {
    headers.authorization = authHeader;
  }
  return headers;
}

async function proxyAuthRequest(req, res, pathname) {
  try {
    const query = normalizeQuery(req.query);
    const body = req.body && Object.keys(req.body).length > 0 ? req.body : undefined;
    const withKey = maybeInjectApiKey(pathname, query, body);

    const url = buildUpstreamUrl(pathname, withKey.query);
    const method = req.method.toUpperCase();

    const options = {
      method,
      headers: {
        ...pickForwardHeaders(req),
      },
    };

    if (method !== 'GET' && method !== 'HEAD') {
      options.headers['content-type'] = 'application/json';
      options.body = JSON.stringify(withKey.body || {});
    }

    const upstreamResponse = await fetch(url, options);
    const contentType = upstreamResponse.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const payload = await upstreamResponse.json().catch(() => ({}));
      return res.status(upstreamResponse.status).json(payload);
    }

    const text = await upstreamResponse.text();
    if (contentType) {
      res.setHeader('content-type', contentType);
    }
    return res.status(upstreamResponse.status).send(text);
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: 'AuthFlow upstream request failed',
      error: error && error.message ? error.message : String(error),
    });
  }
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'authflow-expressjs-proxy',
    authflowBaseUrl: AUTHFLOW_BASE_URL,
    hasApiKey: Boolean(AUTHFLOW_API_KEY),
  });
});

app.get('/', (_req, res) => {
  const docs = {
    name: 'AuthFlow ExpressJS Proxy',
    routes: {
      authProxy: '/auth/*',
      twoFaProxy: '/auth/2fa/*',
      health: '/health',
    },
    examples: [
      'GET /auth/fooBar?identity=user@example.com&role=user',
      'POST /auth/signUp with JSON {"foobar":"<token>","email":"user@example.com","password":"<pw>","fullname":"User Name","role":"user","disclaimed":"true"}',
      'POST /auth/login with JSON {"foobar":"<token>","email":"user@example.com","password":"<pw>","role":"user"}',
      'POST /auth/forgot-password with JSON {"email":"user@example.com","role":"user"}',
      'POST /auth/reset-password with JSON {"token":"<reset_token>","newPassword":"<new_pw>"}',
      'POST /auth/2fa/enable with JSON {"sessionToken":"<token>","email":"user@example.com","org_id":"<org_id>","role":"user"}',
    ],
    note: 'AUTHFLOW_API_KEY is auto-injected for endpoints that require api_key when omitted.',
  };

  res.json(docs);
});

app.all('/auth/*', async (req, res) => {
  const authPath = req.path;
  return proxyAuthRequest(req, res, authPath);
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

module.exports = app;
