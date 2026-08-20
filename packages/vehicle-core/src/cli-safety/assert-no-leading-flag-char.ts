/**
 * Guards against the argv-injection class behind a well-known family of CLI-wrapper CVEs
 * (simple-git's own history includes several): a caller-influenced string that starts with `-`
 * can be parsed by the target CLI as a *flag* (`--upload-pack`, `--exec`, `--template`, `-c`
 * config override) instead of the literal ref/path/pattern value the caller intended. Any Vehicle
 * operation that hands a caller-supplied string to a shelled-out CLI's argv should run it through
 * this check first, at the exact position it reaches that argv.
 *
 * This is a hard rejection with no exceptions -- it has no opinion about *why* a value starting
 * with `-` might be needed and does not attempt to allow-list specific flags. A caller whose CLI
 * genuinely accepts caller-influenced flag-shaped arguments needs a purpose-built allow-list of
 * its own; this primitive only ever covers the common case of a value that should always be a
 * literal.
 */
export class UnsafeCliArgument extends Error {
	constructor(
		readonly value: string,
		readonly fieldName?: string,
	) {
		super(
			fieldName
				? `"${value}" cannot be used as ${fieldName} -- it would be interpreted as a CLI flag, not a literal value`
				: `"${value}" cannot be used as a CLI argument -- it would be interpreted as a flag, not a literal value`,
		);
		this.name = "UnsafeCliArgument";
	}
}

/** Throws UnsafeCliArgument if `value` starts with `-`. `fieldName`, when given, names the field in the thrown error's own message for a caller with several distinct argv positions to check. */
export function assertNoLeadingFlagChar(value: string, fieldName?: string): void {
	if (value.startsWith("-")) throw new UnsafeCliArgument(value, fieldName);
}
