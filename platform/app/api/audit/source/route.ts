import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Source audit not yet implemented" },
    { status: 501 }
  );
}
