import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  const { pathname } = request.nextUrl;

  const protectedRoutes = [
    "/dashboard",
    "/add",
    "/renegotiate",
    "/planning",
    "/reflection",
    "/calendar",
    "/focus",
    "/settings"
  ];

  const isProtected = protectedRoutes.some((route) => 
    pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtected && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/add/:path*",
    "/renegotiate/:path*",
    "/planning/:path*",
    "/reflection/:path*",
    "/calendar/:path*",
    "/focus/:path*",
    "/settings/:path*"
  ],
};
