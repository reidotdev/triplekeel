import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { completeOnboarding } from "@/app/profile-actions";
import { BrandMark } from "@/components/brand-mark";
import { ProfileForm } from "@/components/profile/profile-form";
import { Card } from "@/components/ui";
import { getProfile, isProfileComplete } from "@/src/lib/profile";
import { createSupabaseServerClient } from "@/src/lib/supabase-server";
import { getTrackCatalog } from "@/src/lib/tracks";

export default async function OnboardingPage() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  const result = await getProfile(createSupabaseServerClient(), userId);
  if (result.ok && isProfileComplete(result.profile)) redirect("/dashboard");

  return (
    <main className="mx-auto grid min-h-screen max-w-xl content-start gap-8 px-6 py-12">
      <header>
        <BrandMark />
        <h1 className="text-3xl font-semibold">Set your goal</h1>
        <p className="mt-2 text-sm text-muted">
          Tell us where you are and where you want to go.
        </p>
      </header>
      <Card>
        <ProfileForm
          action={completeOnboarding}
          catalog={getTrackCatalog()}
          submitLabel="Continue"
        />
      </Card>
    </main>
  );
}
