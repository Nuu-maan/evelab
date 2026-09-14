export type Theme = "light" | "dark";

/** Where an explicit choice is kept. Without one, the theme follows the system. */
export const THEME_KEY = "evelab-theme";

/**
 * Runs in the document head before first paint, so a reload never flashes the
 * other theme: the saved choice if there is one, otherwise the system's.
 */
export const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem("${THEME_KEY}");var d=s?s==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=d?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}})()`;
