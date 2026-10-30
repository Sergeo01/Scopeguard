export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { draftPolicyFromText } from "@/lib/drafter";
import { isSameOrigin } from "@/lib/api-guard";

// Per-instance sliding window. This route spends the operator's LLM quota, so
// it is rate limited even though it does not sign anything.
const timestamps: number[] = [];
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { success: false, error: "Cross-origin drafting request rejected." },
      { status: 403 }
    );
  }

  const now = Date.now();
  while (timestamps.length > 0 && timestamps[0] < now - WINDOW_MS) timestamps.shift();
  if (timestamps.length >= MAX_PER_WINDOW) {
    return NextResponse.json(
      { success: false, error: "Rate limit: too many draft requests. Please wait a minute." },
      { status: 429 }
    );
  }
  timestamps.push(now);

  try {
    const body = await req.json();
    const prompt = body?.prompt || body?.promptText || "";

    if (!prompt.trim()) {
      return NextResponse.json(
        { success: false, error: "Prompt text is required." },
        { status: 400 }
      );
    }

    if (prompt.length > 2000) {
      return NextResponse.json(
        { success: false, error: "Prompt is too long (max 2000 characters)." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const result = await draftPolicyFromText(prompt, { apiKey });

    return NextResponse.json({ success: true, draft: result });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
