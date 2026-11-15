import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { updateProfile } from "@/app/profile-actions";
import { ProfileForm } from "@/components/profile/profile-form";
import { Card, Link } from "@/components/ui";
import { getProfile, isProfileComplete } from "@/src/lib/profile";
import { createSupabaseServerClient } from "@/src/lib/supabase-server";
import { getTrackCatalog } from "@/src/lib/tracks";

export default async function ProfileSettingsPage() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  const result = await getProfile(createSupabaseServerClient(), userId);
  if (result.ok && !isProfileComplete(result.profile)) redirect("/onboarding");

  return (
    <main className="mx-auto grid min-h-screen max-w-xl content-start gap-8 px-6 py-12">
      <header>
        <p className="text-sm text-muted">Settings</p>
        <h1 className="text-3xl font-semibold">Your profile</h1>
        <p className="mt-2 text-sm">
          <Link href="/dashboard">Back to dashboard</Link>
          {" · "}
          <Link href="/settings/account">Account</Link>
        </p>
      </header>
      <Card>
        {result.ok && isProfileComplete(result.profile) ? (
          <ProfileForm
            action={updateProfile}
            catalog={getTrackCatalog()}
            submitLabel="Save"
            initial={{
              jobTitle: result.profile.job_title,
              currentLevel: result.profile.current_level,
              targetLevel: result.profile.target_level,
              choice: result.profile.track_id ? "try" : "wait",
            }}
          />
        ) : (
          <p className="text-sm">Could not load your profile. Try again.</p>
        )}
      </Card>
      <p className="text-sm text-muted">
        To delete your account and all your data, go to{" "}
        <Link href="/settings/account">Account</Link>.
      </p>
    </main>
  );
}
