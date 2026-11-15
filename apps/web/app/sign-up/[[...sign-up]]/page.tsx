import { SignUp } from "@clerk/nextjs";
import { Link } from "@/components/ui";

export default function SignUpPage() {
  return (
    <main className="grid min-h-screen place-items-center content-center gap-4 px-4 py-12">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/onboarding"
      />
      <p className="max-w-sm text-center text-sm text-muted">
        By signing up you agree to how we handle data:{" "}
        <Link href="/privacy">Privacy</Link>.
      </p>
    </main>
  );
}
