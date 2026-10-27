export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { draftPolicyFromText } from "@/lib/drafter";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = body?.prompt || body?.promptText || "";

    if (!prompt.trim()) {
      return NextResponse.json(
        { success: false, error: "Prompt text is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const result = await draftPolicyFromText(prompt, { apiKey });

    return NextResponse.json({
      success: true,
      draft: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
