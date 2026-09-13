/** Resizable panes: bounds in CSS pixels, shared by the server and the drag handle. */
export const PANES = {
  sidebar: { min: 200, max: 360, initial: 240 },
  explorer: { min: 180, max: 520, initial: 260 },
  palette: { min: 200, max: 400, initial: 256 },
  inspector: { min: 300, max: 900, initial: 360 },
} as const;

export type PaneName = keyof typeof PANES;

export function paneCookie(pane: PaneName): string {
  return `evelab-pane-${pane}`;
}
