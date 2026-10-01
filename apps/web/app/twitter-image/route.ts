import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

async function getImageBuffer() {
  const candidatePaths = [
    path.join(process.cwd(), "public", "twitter-image.png"),
    path.join(process.cwd(), "apps/web", "public", "twitter-image.png"),
  ];
  for (const p of candidatePaths) {
    try {
      return await fs.readFile(p);
    } catch {
      // try next path
    }
  }
  throw new Error("twitter-image.png not found");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const version = searchParams.get("v");

  // When unversioned, redirect with a fresh timestamp parameter to prevent caching
  if (!version) {
    const versionedUrl = new URL(request.url);
    versionedUrl.searchParams.set("v", Date.now().toString());
    return NextResponse.redirect(versionedUrl, {
      status: 307,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  try {
    const buffer = await getImageBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
