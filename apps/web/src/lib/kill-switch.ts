export function isKillSwitchEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}
