type Environment = Readonly<Record<string, string | undefined>>;

/** Legacy fixture writes belong only to an unconfigured local development database. */
export function shouldSeedImplicitDevelopmentDatabase(
  env: Environment,
  state: Readonly<{ demoMode: boolean; productionMode: boolean; alreadySeeded: boolean }>,
): boolean {
  return env.NODE_ENV === "development" && env.VERCEL !== "1" &&
    !state.demoMode && !state.productionMode && !state.alreadySeeded &&
    env.TASKS_DATABASE_URL === undefined && env.TASKS_AUTH_TOKEN === undefined;
}
