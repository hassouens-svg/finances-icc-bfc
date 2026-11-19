import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has("icc_s") && req.cookies.has("icc_u");
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/app") && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/dev") && process.env.NODE_ENV === "production" && process.env.ENABLE_STYLEGUIDE !== "true") {
    return NextResponse.rewrite(new URL("/404", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/dev/:path*"] };
