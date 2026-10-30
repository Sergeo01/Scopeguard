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

export function guardSigningRequest(req: Request, fallbackCommand: string): NextResponse | null {
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { success: false, error: "Cross-origin signing request rejected." },
      { status: 403 }
    );
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
  return null;
}
