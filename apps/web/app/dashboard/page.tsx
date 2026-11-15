import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { KeelCheckPanel } from "@/components/keel-check";
import { SkillMatrix } from "@/components/skill-matrix";
import { Card, Link } from "@/components/ui";
import { readKeelCheckHistory } from "@/src/lib/keel-check";
import {
  getProfile,
  isProfileComplete,
  profileSummary,
} from "@/src/lib/profile";
import type { SkillMatrixData } from "@/src/lib/skill-matrix";
import { loadSkillMatrix } from "@/src/lib/skill-matrix-data";
import { createSupabaseServerClient } from "@/src/lib/supabase-server";
import { getTrackCatalog } from "@/src/lib/tracks";

/** The latest keel check card plus this many earlier ones. */
const EARLIER_KEEL_CHECKS = 10;

/** Changes when new reports arrive, so polling keeps going while they do. */
function matrixVersion(matrix: SkillMatrixData | null): string {
  if (!matrix) return "error";
  return matrix.kind === "levels" ? String(matrix.totalPrompts) : "0";
}

export default async function DashboardPage() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  const supabase = createSupabaseServerClient();
  const result = await getProfile(supabase, userId);
  if (result.ok && !isProfileComplete(result.profile)) redirect("/onboarding");
  const profile =
    result.ok && isProfileComplete(result.profile) ? result.profile : null;
  const catalog = getTrackCatalog();

  // Waitlisted users without a track get no matrix and no keel check.
  const trackId = profile?.track_id ?? null;
  const [matrix, keelChecks] =
    profile && trackId
      ? await Promise.all([
          loadSkillMatrix(supabase, { ...profile, track_id: trackId }, catalog),
          readKeelCheckHistory(supabase, EARLIER_KEEL_CHECKS + 1),
        ])
      : [null, null];
  const keelCheck = keelChecks ? (
    <KeelCheckPanel
      history={keelChecks}
      totalPrompts={matrix?.kind === "levels" ? matrix.totalPrompts : 0}
    />
  ) : null;

  return (
    <main className="mx-auto grid min-h-screen max-w-4xl content-start gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <BrandMark />
          <h1 className="text-3xl font-semibold">Your dashboard</h1>
        </div>
        <UserButton />
      </header>
      {matrix ? (
        // The matrix header already shows the track and levels.
        <p className="text-sm">
          <Link href="/settings/profile">Edit profile</Link>
        </p>
      ) : (
        <Card>
          {profile ? (
            <>
              <h2 className="text-lg font-semibold">
                {profileSummary(profile, catalog)}
              </h2>
              {profile.track_id ? null : (
                <p className="mt-2 text-sm text-muted">
                  Not supported yet. You are on the waitlist.
                </p>
              )}
              <p className="mt-2 text-sm">
                <Link href="/settings/profile">Edit profile</Link>
              </p>
            </>
          ) : (
            <p className="text-sm">Could not load your profile. Try again.</p>
          )}
        </Card>
      )}
      {profile && trackId ? (
        <>
          {matrix ? (
            <SkillMatrix data={matrix} keelCheckSlot={keelCheck} />
          ) : (
            <>
              <Card>
                <p className="text-sm">
                  Could not load your skills. Try again.
                </p>
              </Card>
              {keelCheck}
            </>
          )}
          <AutoRefresh version={matrixVersion(matrix)} />
        </>
      ) : (
        <Card>
          <h2 className="text-lg font-semibold">Your practice starts here</h2>
          <p className="mt-2 text-sm text-muted">
            Your skills and weekly suggestions will appear here.
          </p>
        </Card>
      )}
    </main>
  );
}
