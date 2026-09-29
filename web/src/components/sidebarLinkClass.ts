export function sidebarLinkClass({ isActive }: { isActive: boolean }): string {
  return `eng-card${isActive ? " active" : ""}`;
}
