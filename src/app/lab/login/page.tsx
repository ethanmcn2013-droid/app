/**
 * /lab/login — three login-screen directions under review.
 *
 * Review-only: no auth, no Clerk mount, no server actions, nothing posts.
 * robots noindex, same contract as /lab/task-detail.
 *
 * See src/components/lab/login/README.md.
 */

import type { Metadata } from "next";
import { LoginIndex } from "@/components/lab/login/login-index";

export const metadata: Metadata = {
  title: "Login directions · lab",
  description: "Three sign-in designs under review. Not for production.",
  robots: { index: false, follow: false },
};

export default function LoginLabIndexRoute() {
  return <LoginIndex />;
}
