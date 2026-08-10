/**
 * Single source of truth for the "there's more, press a key to see it"
 * affordance every collapsed Vehicle-backed Pi tool card needs. Extracted
 * after the identical idea was found independently reinvented at least
 * three times across this house's own Pi extensions before this module
 * existed: this file's own moreRowsLine() (private, table-row-truncation
 * specific), papyrus's ArtifactCard.expandHint(), and web-spider's
 * session-presentation.ts -- each duplicating the same
 * keyHint("app.tools.expand", ...) call inline, with web-spider's own
 * web_fetch/web_quotes cards missing it entirely at various points. A
 * consumer extension (or this package's own vehicle-render.ts) should
 * import this instead of re-deriving either piece.
 */
import { keyHint } from "@earendil-works/pi-coding-agent";

/**
 * Real, possibly user-remapped hotkey (defaults to ctrl+o, Pi's own
 * "app.tools.expand" binding) -- never a hardcoded string. `description`
 * lets a call site phrase it appropriately ("expand for details", "to
 * expand", etc.) while the keybinding id itself stays centralized here.
 */
export function expandHint(description = "expand for details"): string {
	return keyHint("app.tools.expand", description);
}

/**
 * True exactly when collapsing genuinely hides something an expand would
 * reveal. Centralizing this (rather than each card re-deriving its own "is
 * there more?" condition ad hoc) is what keeps the hint from either going
 * missing on a card that really does hide content, or appearing
 * decoratively on one that doesn't.
 */
export function shouldShowExpandHint(expanded: boolean, hasHiddenContent: boolean): boolean {
	return !expanded && hasHiddenContent;
}
