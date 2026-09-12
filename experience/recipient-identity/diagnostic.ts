type VisibilityProbe = Readonly<{
  isVisible(): Promise<boolean>;
}>;

type VisibilityCollection = Readonly<{
  all(): Promise<VisibilityProbe[]>;
}>;

export type PageErrorClass =
  | "none"
  | "missingClerkProvider"
  | "multipleClerkProviders"
  | "hydration"
  | "other";

export function classifyPageError(error: Error): PageErrorClass {
  const message = `${error.name}\n${error.message}\n${error.stack ?? ""}`.toLowerCase();
  if (message.includes("multiple <clerkprovider>") || message.includes("multipleclerkproviders")) {
    return "multipleClerkProviders";
  }
  if (message.includes("can only be used within the <clerkprovider") || message.includes("missingclerkprovider")) {
    return "missingClerkProvider";
  }
  if (message.includes("hydration") || message.includes("hydrating")) {
    return "hydration";
  }
  return "other";
}

export async function anyMatchVisible(
  collection: VisibilityCollection,
): Promise<boolean> {
  const matches = await collection.all();
  for (const match of matches) {
    if (await match.isVisible()) return true;
  }
  return false;
}
