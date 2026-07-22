import { ClerkRuntimeProvider } from "@/components/clerk-runtime-provider";
import { isDemoMode } from "@/lib/access-mode";

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return isDemoMode()
    ? children
    : <ClerkRuntimeProvider>{children}</ClerkRuntimeProvider>;
}
