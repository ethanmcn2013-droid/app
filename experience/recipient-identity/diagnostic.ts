type VisibilityProbe = Readonly<{
  isVisible(): Promise<boolean>;
}>;

type VisibilityCollection = Readonly<{
  all(): Promise<VisibilityProbe[]>;
}>;

export async function anyMatchVisible(
  collection: VisibilityCollection,
): Promise<boolean> {
  const matches = await collection.all();
  for (const match of matches) {
    if (await match.isVisible()) return true;
  }
  return false;
}
