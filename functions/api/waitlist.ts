/**
 * POST /api/waitlist
 *
 * Cloudflare Pages Function. Stores a waitlist signup in a KV namespace
 * bound to this Pages project as `WAITLIST`.
 *
 * KV key layout:
 *   email:<lowercased-email>       -> JSON { email, games, submittedAt, ipHashPrefix }
 *   ip:<hash-prefix>:<ymd>         -> counter (for per-IP daily rate limit)
 *   total                          -> incrementing integer (for quick stats)
 *
 * Required binding (set in Cloudflare Pages → Settings → Functions →
 * KV namespace bindings):
 *   Variable name: WAITLIST
 *   KV namespace:  (whichever you created, e.g. "mirage-atlas-waitlist")
 *
 * Free tier is more than enough: 1,000 KV writes/day covers ~30k signups/month.
 */

interface Env {
  WAITLIST: KVNamespace;
}

type Ctx = EventContext<Env, string, Record<string, unknown>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const MAX_GAMES_LEN = 200;
const PER_IP_DAILY_LIMIT = 5;

async function ipHashPrefix(ip: string): Promise<string> {
  // Truncated SHA-256 of the raw IP — stored so we can rate-limit without
  // retaining the IP itself. 10 hex chars = ~40 bits of entropy, more than
  // enough to distinguish residential addresses for a day.
  const data = new TextEncoder().encode(`mirage-atlas-ip::${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .slice(0, 5)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function ymd(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

export const onRequestPost = async (ctx: Ctx): Promise<Response> => {
  const { request, env } = ctx;

  if (!env.WAITLIST) {
    return jsonResponse(
      { error: 'Waitlist storage is not configured yet. Please try again shortly.' },
      503,
    );
  }

  let body: { email?: string; games?: string; company?: string } = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  // Honeypot. Anything in `company` means a bot filled the hidden field.
  if (body.company && body.company.length > 0) {
    return jsonResponse({ message: "You're on the list. We'll be in touch on launch day." });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const games = String(body.games ?? '').trim().slice(0, MAX_GAMES_LEN);

  if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    return jsonResponse({ error: 'Please enter a valid email address.' }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-real-ip') || '0.0.0.0';
  const hashPrefix = await ipHashPrefix(ip);
  const rateKey = `ip:${hashPrefix}:${ymd()}`;

  const rateRaw = await env.WAITLIST.get(rateKey);
  const rateCount = rateRaw ? Number.parseInt(rateRaw, 10) || 0 : 0;
  if (rateCount >= PER_IP_DAILY_LIMIT) {
    return jsonResponse({ error: 'Too many signups from this network today. Try again tomorrow.' }, 429);
  }

  const emailKey = `email:${email}`;
  const existing = await env.WAITLIST.get(emailKey);
  if (existing) {
    // Idempotent — treat as success, don't reveal membership.
    return jsonResponse({ message: "You're already on the list. We'll be in touch on launch day." });
  }

  const record = {
    email,
    games,
    submittedAt: new Date().toISOString(),
    ipHashPrefix: hashPrefix,
    userAgent: request.headers.get('user-agent')?.slice(0, 200) ?? '',
    country: request.headers.get('cf-ipcountry') ?? '',
  };

  await Promise.all([
    env.WAITLIST.put(emailKey, JSON.stringify(record)),
    env.WAITLIST.put(rateKey, String(rateCount + 1), { expirationTtl: 60 * 60 * 36 }),
  ]);

  // Best-effort counter; don't fail the request if this errors.
  try {
    const totalRaw = await env.WAITLIST.get('total');
    const total = totalRaw ? Number.parseInt(totalRaw, 10) || 0 : 0;
    await env.WAITLIST.put('total', String(total + 1));
  } catch {
    /* ignore */
  }

  return jsonResponse({ message: "You're on the list. We'll email you the day TestFlight opens." });
};

export const onRequest = async (): Promise<Response> =>
  jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
