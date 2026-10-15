export type SettingsFieldValue = string | boolean;

/** Keeps the first focused value as the baseline, even if a control remounts. */
export class SettingsOverlayDrafts {
  private readonly baselineByField = new Map<string, SettingsFieldValue>();
  private readonly dirtyFields = new Set<string>();

  get hasDraft(): boolean {
    return this.dirtyFields.size > 0;
  }

  captureBaseline(key: string, value: SettingsFieldValue): void {
    if (!this.baselineByField.has(key)) this.baselineByField.set(key, value);
  }

  update(key: string, value: SettingsFieldValue): boolean {
    this.captureBaseline(key, value);
    if (value === this.baselineByField.get(key)) this.dirtyFields.delete(key);
    else this.dirtyFields.add(key);
    return this.hasDraft;
  }
}
