import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function readPrompt(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const record = body as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;
  if (typeof record.prompt === "string") return record.prompt;
  return "";
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server is missing GEMINI_API_KEY." },
        { status: 500 },
      );
    }

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const prompt = readPrompt(body).trim();
    if (!prompt) {
      return NextResponse.json(
        { error: "A non-empty `message` or `prompt` string is required." },
        { status: 400 },
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "Gemini request failed." }, { status: 500 });
  }
}
