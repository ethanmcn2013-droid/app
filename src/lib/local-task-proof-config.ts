type Environment = Readonly<Record<string, string | undefined>>;

/** Next inlines this config into Proxy at build time and reads it again at
 * server startup. The private build therefore needs its own explicit marker;
 * ordinary production builds keep Next's default URL normalization. */
export function localTaskProofUrlNormalization(env: Environment = process.env): boolean {
  const flags = [env.SIGNAL_LOCAL_TASK_PROOF_BUILD, env.SIGNAL_LOCAL_TASK_OPERATIONS];
  if (flags.some(value => value !== undefined && value !== "true" && value !== "false")) throw new Error("Invalid local proof marker");
  if (!flags.includes("true")) return false;
  if (env.NODE_ENV !== "production" || env.VERCEL !== undefined || env.VERCEL_ENV !== undefined ||
    env.SIGNAL_ACCESS_MODE !== "production" || env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE !== "production" ||
    env.DEMO_MODE === "true" || env.NEXT_PUBLIC_DEMO_MODE === "true") throw new Error("Invalid local proof posture");
  const origin = env.SIGNAL_LOCAL_TASK_ORIGIN;
  try {
    if (!origin || !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{3,4}$/.test(origin) || new URL(origin).origin !== origin) throw new Error();
  } catch { throw new Error("Exact local proof origin required"); }
  return true;
}
