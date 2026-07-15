import { SignIn } from "@clerk/nextjs";
import { Wordmark } from "@/components/brand/wordmark";
import { DemoAuthCard } from "@/components/auth/demo-auth-card";
import { isDemoMode } from "@/lib/access-mode";

export const metadata = { title: "Sign in, Tasks" };

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="px-6 pt-6">
        <Wordmark size="md" />
      </div>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        {isDemoMode() ? <DemoAuthCard mode="sign-in" /> : <SignIn />}
      </main>
    </div>
  );
}
