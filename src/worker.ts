interface Env {
  WAITLIST: KVNamespace;
  ASSETS: Fetcher;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;
const MAX_GAMES_LEN = 200;
const PER_IP_DAILY_LIMIT = 5;

async function ipHashPrefix(ip: string): Promise<string> {
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

async function handleWaitlist(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  }

  if (!env.WAITLIST) {
    return jsonResponse(
      { error: 'Waitlist storage is not configured yet. Please try again shortly.' },
      503,
    );
  }

  let body: { email?: string; games?: string; company?: string; website?: string } = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const honeypot = body.company ?? body.website ?? '';
  if (honeypot && honeypot.length > 0) {
    return jsonResponse({ ok: true, message: "You're on the list. We'll be in touch on launch day." });
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
    return jsonResponse({ ok: true, message: "You're already on the list. We'll be in touch on launch day." });
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

  try {
    const totalRaw = await env.WAITLIST.get('total');
    const total = totalRaw ? Number.parseInt(totalRaw, 10) || 0 : 0;
    await env.WAITLIST.put('total', String(total + 1));
  } catch {
    /* ignore */
  }

  return jsonResponse({ ok: true, message: "You're on the list. We'll email you the day TestFlight opens." });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/waitlist') {
      return handleWaitlist(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
