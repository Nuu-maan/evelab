/** Whether the project sidebar is shown, shared by the server layout and the toggle. */
export const SIDEBAR_COOKIE = "evelab-sidebar";

export type SidebarState = "open" | "closed";

export function parseSidebarState(value: string | undefined): SidebarState {
  return value === "closed" ? "closed" : "open";
}
