import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Handle .jet files with no-cache headers to prevent client caching issues
  if (request.nextUrl.pathname.endsWith(".jet")) {
    const response = NextResponse.next();

    // Prevent caching of .jet files since they contain dynamic game data
    response.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    console.log(`🚫 Disabled caching for: ${request.nextUrl.pathname}`);

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
