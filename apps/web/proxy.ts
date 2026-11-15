import { clerkMiddleware } from "@clerk/nextjs/server";
import { isKillSwitchEnabled } from "@/src/lib/kill-switch";
import { isProtectedPath } from "@/src/protected-routes";

export default clerkMiddleware(async (auth, request) => {
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    request.nextUrl.pathname !== "/api/webhooks/clerk" &&
    isKillSwitchEnabled(process.env.KILL_SWITCH)
  ) {
    return Response.json(
      { error: "API is temporarily unavailable" },
      { status: 503 },
    );
  }

  if (isProtectedPath(request.nextUrl.pathname)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
