# authflow-expressjs-proxy

ExpressJS proxy app that integrates with all AuthFlow `/auth` routes (including `/auth/2fa/*`) and is ready to deploy to Vercel.

## What this proxy gives you

- Express server with JSON + URL-encoded request parsing
- Full AuthFlow proxy for:
  - `GET /auth/fooBar`
  - `POST /auth/signUp`
  - `GET /auth/resend-verify-email`
  - `GET /auth/verify-email`
  - `POST /auth/login`
  - `POST /auth/forgot-password`
  - `POST /auth/reset-password`
  - `POST /auth/changePassword`
  - `GET /auth/validate`
  - `GET /auth/me`
  - `GET /auth/logout`
  - `POST /auth/deleteUser`
  - all `/auth/2fa/*` routes (enable, verify-setup, disable, verify-2fa, backup/email, verify-email-otp, recovery-codes, verify-recovery)
- Automatic `api_key` injection from environment for endpoints that require it when omitted
- Vercel deployment wiring via `api/index.js` + `vercel.json`

## 1. Configure environment

```bash
cp .env.example .env
```

Then set:

```bash
AUTHFLOW_BASE_URL=https://api.authflow.net
AUTHFLOW_API_KEY=af_your_owner_org_api_key
PORT=3000
```

## 2. Run locally

```bash
npm install
npm run dev
```

Open:

- `http://localhost:3000/` for route docs
- `http://localhost:3000/health` for health check

## 3. Example calls

Generate anti-abuse token:

```bash
curl "http://localhost:3000/auth/fooBar?identity=user@example.com&role=user"
```

Sign up auth user:

```bash
curl "http://localhost:3000/auth/signUp?foobar=<TOKEN>&email=user@example.com&password=Passw0rd!&fullname=Demo%20User&role=user&disclaimed=true"
```

Log in auth user:

```bash
curl "http://localhost:3000/auth/login?foobar=<TOKEN>&email=user@example.com&password=Passw0rd!&role=user"
```

Forgot password:

```bash
curl -X POST "http://localhost:3000/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","role":"user"}'
```

Reset password:

```bash
curl -X POST "http://localhost:3000/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{"token":"<RESET_TOKEN>","newPassword":"N3wPassw0rd!"}'
```

Enable 2FA setup:

```bash
curl -X POST "http://localhost:3000/auth/2fa/enable" \
  -H "Content-Type: application/json" \
  -d '{"sessionToken":"<SESSION_TOKEN>","email":"user@example.com","org_id":"<ORG_ID>","role":"user"}'
```

## 4. Deploy to Vercel

From this folder:

```bash
vercel
```

Set env vars in Vercel project settings:

- `AUTHFLOW_BASE_URL`
- `AUTHFLOW_API_KEY`

Then deploy production:

```bash
vercel --prod
```

## Notes

- Authorization headers are forwarded to AuthFlow automatically.
- For required `api_key` routes, this proxy injects `AUTHFLOW_API_KEY` if your request omits `api_key`.
- The proxy intentionally does not store user credentials or sessions locally; it proxies directly to AuthFlow.
