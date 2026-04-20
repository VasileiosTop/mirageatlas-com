# mirageatlas.com

Pre-launch marketing site for **Mirage Atlas**, the offline AI companion for gacha games.
Built by **Mirage Interactive Ltd**.

## Stack

- **Astro 5** (static output)
- **Tailwind CSS 3**
- **Cloudflare Pages** (hosting)
- **Cloudflare Pages Functions + KV** (waitlist backend)

All free-tier. No paid dependencies.

## Local development

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # static output to ./dist
npm run preview      # serve ./dist locally
```

Astro lives in `src/`. Cloudflare Page Functions live in `functions/` and are bundled at deploy time.

## Deploying to Cloudflare Pages

1. Push this repo to GitHub (public or private).
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → select this repo.
3. Set:
   - **Framework preset**: Astro
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node version**: 20
4. Deploy.

### Waitlist — one-time KV setup

The `/api/waitlist` function expects a KV namespace bound as `WAITLIST`.

1. Cloudflare dashboard → **Workers & Pages** → **KV** → **Create namespace**. Name it e.g. `mirage-atlas-waitlist`.
2. Go to this Pages project → **Settings** → **Functions** → **KV namespace bindings**.
3. Add:
   - **Variable name**: `WAITLIST`
   - **KV namespace**: the one you just created
4. Trigger a redeploy (Deployments → re-run latest).

### Custom domain

1. Pages project → **Custom domains** → **Set up a custom domain**.
2. Add `mirageatlas.com` and `www.mirageatlas.com`.
3. Cloudflare auto-issues TLS on Universal SSL. The `_redirects` file in `public/` already 301s `www` → apex.

## KV schema

| Key pattern | Value | Purpose |
|---|---|---|
| `email:<lowercase-email>` | JSON record | One row per signup |
| `ip:<hashprefix>:<YYYY-MM-DD>` | counter | Daily per-IP rate limit (expires 36h) |
| `total` | counter | Quick aggregate |

### Export signups at launch

Cloudflare dashboard → KV → this namespace → **List** → filter prefix `email:` →
**Export as CSV**. Or via `wrangler`:

```bash
wrangler kv:key list --binding=WAITLIST --prefix="email:"
```

## Security headers

Set in `public/_headers`. CSP is strict: no inline scripts beyond what ships with the Astro bundle, no third-party frames, no mixed content.

## What this site is not

- Not a blog. (Swap to Astro Content Collections when ready.)
- Not an e-commerce surface.
- Not tracking you. No GA, no pixels, no cookie banner.
