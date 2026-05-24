import { NextRequest, NextResponse } from "next/server";
const FLASK = process.env.FLASK_API_URL || "http://localhost:5000";

export async function POST(req: NextRequest) {
  const conf = new URL(req.url).searchParams.get("conf") || "0.4";
  try {
    const body = await req.arrayBuffer();
    const ct   = req.headers.get("content-type") || "";
    const res  = await fetch(`${FLASK}/api/analyze?conf=${conf}`, {
      method: "POST", headers: { "content-type": ct }, body,
    });
    const text = await res.text();
    try { return NextResponse.json(JSON.parse(text), { status: res.status }); }
    catch { return NextResponse.json({ error: `Flask error: ${text.slice(0,200)}` }, { status: 502 }); }
  } catch (e: unknown) {
    return NextResponse.json({ error: `Cannot reach Flask: ${e instanceof Error ? e.message : e}` }, { status: 503 });
  }
}
