import { NextResponse } from "next/server";

/**
 * Server-side signing is OFF by default.
 *
 * Any route that signs with the owner key is an owner-authority endpoint. On a
 * public deployment that is a liability, so the operator must explicitly opt in
 * with SCOPEGUARD_ALLOW_SERVER_SIGNING=true. When the flag is absent every
 * signing route returns a copy-paste CLI command instead of broadcasting.
 */
export function serverSigningEnabled(): boolean {
  return process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING === "true";
}

/**
 * The agent key is only ever read from the environment. It is never stored in
 * source, never bundled into client code, and never read from a credentials
 * file inside a request handler.
 */
export function agentSigningEnabled(): boolean {
  return Boolean(process.env.SCOPEGUARD_AGENT_PRIVATE_KEY);
}

/**
 * Rejects cross-site browser requests. Requests without an Origin header
 * (curl, server-to-server) pass this check, which is why it is a second layer
 * behind the explicit signing flag rather than the only control.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Rate Limiting for Hosted Demo Endpoints
// ---------------------------------------------------------------------------
interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();

let lastAttackTimestamp = 0;
let isAttackInProgress = false;
const attackTimestamps: number[] = [];
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_ATTACKS_PER_WINDOW = 12;

export function resetAttackThrottles(): void {
  lastAttackTimestamp = 0;
  isAttackInProgress = false;
  attackTimestamps.length = 0;
}

export function checkAttackThrottle(): { allowed: boolean; status?: number; error?: string } {
  const now = Date.now();
  if (isAttackInProgress) {
    return {
      allowed: false,
      status: 409,
      error: "An attack scenario is currently running. Please wait for completion.",
    };
  }
  if (now - lastAttackTimestamp < 1500) {
    return {
      allowed: false,
      status: 429,
      error: "Rate limit: please wait 1.5 seconds between onchain calls.",
    };
  }
  while (attackTimestamps.length > 0 && now - attackTimestamps[0] > RATE_LIMIT_WINDOW_MS) {
    attackTimestamps.shift();
  }
  if (attackTimestamps.length >= MAX_ATTACKS_PER_WINDOW) {
    return {
      allowed: false,
      status: 429,
      error: "Attack rate limit reached (max 12 per minute). Please wait.",
    };
  }
  attackTimestamps.push(now);
  lastAttackTimestamp = now;
  return { allowed: true };
}

export function setAttackInProgress(inProgress: boolean): void {
  isAttackInProgress = inProgress;
}

export function checkRateLimit(key: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) {
    return false;
  }
  bucket.count++;
  return true;
}

export function resetRateLimits(): void {
  rateLimitBuckets.clear();
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

/**
 * Validates request safety for privileged signing routes:
 * 1. Blocks cross-origin browser requests with 403.
 * 2. Requires shared secret for non-browser callers if SCOPEGUARD_SHARED_SECRET is set (401).
 * 3. Falls back safely to manual CLI command if server signing is disabled (200).
 * 4. Applies rate limiting when server signing is enabled (429).
 */
export function guardSigningRequest(req: Request, fallbackCommand: string): NextResponse | null {
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { success: false, error: "Cross-origin signing request rejected." },
      { status: 403 }
    );
  }

  // Non-browser caller check (curl, scripts, direct HTTP): require shared secret if configured
  const origin = req.headers.get("origin");
  const sharedSecret = process.env.SCOPEGUARD_SHARED_SECRET;
  if (!origin && sharedSecret) {
    const authHeader = req.headers.get("authorization") || "";
    const customHeader = req.headers.get("x-scopeguard-secret") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (customHeader !== sharedSecret && bearer !== sharedSecret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Missing or invalid shared secret." },
        { status: 401 }
      );
    }
  }

  if (!serverSigningEnabled()) {
    return NextResponse.json({
      success: false,
      requiresOwnerSignature: true,
      message:
        "Server-side signing is disabled. Run this command with your owner key, or set SCOPEGUARD_ALLOW_SERVER_SIGNING=true to enable the hosted demo.",
      command: fallbackCommand,
    });
  }

  // Rate limiting for enabled server signing
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded. Please wait before retrying." },
      { status: 429 }
    );
  }

  return null;
}
