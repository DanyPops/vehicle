/**
 * Shared text-safety primitives used by both vehicle-render's call- and result-rendering halves.
 * Split out of vehicle-render.ts's own bundled concerns (Vehicle Pass 1 SRP audit finding #6).
 */

import { truncateToWidth as truncateToWidthUnsafe, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { neutralizeEmbeddedFullResets, safeTruncateToWidth, type TextMeasure } from "malevich-tui-components";

/**
 * Re-exported for existing consumers of this module's own subpath (`@danypops/vehicle-client-pi/
 * vehicle-render`) -- this used to be this function's origin, but it fixes a real host
 * `truncateToWidth` behavior, not a Vehicle-specific concern, and Malevich (already a shared
 * dependency of every affected package) is the more honest home for it now. See its own doc
 * comment there for the full diagnosis.
 */
export { neutralizeEmbeddedFullResets };

/**
 * Delegates to Malevich's own safeTruncateToWidth (the canonical, already-guarded composition --
 * see its own doc comment) instead of re-deriving the truncate+neutralize pairing locally. Still
 * guards its OWN import of safeTruncateToWidth: a long-running process can hold an in-memory copy
 * of Malevich resolved from before this export existed there, while this file's own code --
 * reloaded more recently -- still assumes it's present. Falls back to the unguarded
 * truncateToWidthUnsafe output rather than throwing.
 */
export function truncateToWidth(text: string, maxWidth: number, ellipsis?: string, pad?: boolean): string {
	if (typeof safeTruncateToWidth !== "function") return truncateToWidthUnsafe(text, maxWidth, ellipsis, pad);
	return safeTruncateToWidth(truncateToWidthUnsafe, text, maxWidth, ellipsis, pad);
}

export const measure: TextMeasure = { visibleWidth, truncateToWidth, wrapTextWithAnsi };
