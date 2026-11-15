import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Card, Link } from "@/components/ui";
import {
  getProfile,
  isProfileComplete,
  profileSummary,
} from "@/src/lib/profile";
import { createSupabaseServerClient } from "@/src/lib/supabase-server";
import { getTrackCatalog } from "@/src/lib/tracks";

export default async function DashboardPage() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  const result = await getProfile(createSupabaseServerClient(), userId);
  if (result.ok && !isProfileComplete(result.profile)) redirect("/onboarding");
  const profile =
    result.ok && isProfileComplete(result.profile) ? result.profile : null;

  return (
    <main className="mx-auto grid min-h-screen max-w-4xl content-start gap-8 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">TripleKeel</p>
          <h1 className="text-3xl font-semibold">Your dashboard</h1>
        </div>
        <UserButton />
      </header>
      <Card>
        {profile ? (
          <>
            <h2 className="text-lg font-semibold">
              {profileSummary(profile, getTrackCatalog())}
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
      <Card>
        <h2 className="text-lg font-semibold">Your practice starts here</h2>
        <p className="mt-2 text-sm text-muted">
          Your skills and weekly suggestions will appear here.
        </p>
      </Card>
    </main>
  );
}
