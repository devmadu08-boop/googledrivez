# PixVault

PixVault is a Next.js media vault that stores uploaded photos as Base64 JSON records in a GitHub repository and presents them as video-style file cards.

## Features

- Google Drive-inspired responsive file manager
- Photo uploads stored as text through the GitHub Contents API
- Email and note access requests with no user passwords
- Browser-bound approval: accepted access cannot be reused from another browser
- Password-protected admin review panel at `/admin`
- Persistent request state and rate limiting with Upstash Redis

## Local setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

Required environment variables:

```text
GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPO=
GITHUB_BRANCH=main
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
```

`GITHUB_TOKEN`, Redis credentials, the admin password, and session secret must remain server-side secrets. Never prefix them with `NEXT_PUBLIC_` or commit them.

## Vercel deployment

1. Import the GitHub repository into Vercel.
2. Add an Upstash Redis integration from the Vercel Marketplace.
3. Add the GitHub and admin environment variables for Production and Preview.
4. Redeploy after changing environment variables.

## Validation

```bash
npm run typecheck
npm run lint
npm run build
```
