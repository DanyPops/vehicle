import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_GIT_OUTPUT_BYTES = 2_000_000;
const PACKAGES = new Map([
	["vehicle-core", "packages/vehicle-core"],
	["vehicle-server", "packages/vehicle-server"],
]);
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function git(args) {
	return execFileSync("git", args, { encoding: "utf8", maxBuffer: MAX_GIT_OUTPUT_BYTES }).trim();
}

/**
 * A name only counts as a real, npm-consumer-reachable ADDITION if it appears in one of the
 * package's own declared "exports" .d.ts targets -- not merely anywhere under dist/, which tsc
 * populates with a .d.ts for every compiled module whether or not package.json's own exports
 * map ever points a consumer at it. Confirmed live splitting vehicle-server's daemon.ts into
 * daemon/{listener,bun-listener,node-listener}.ts: the internal-only ListeningServer/DaemonApp
 * types had to become file-scope `export`ed so the 3 new sibling files could import each other,
 * which the raw-source-diff heuristic in findBreakingTypeCandidates can't distinguish from an
 * actual npm-published breaking addition. Requires a fresh build (dist/ populated) before this
 * runs -- see publish.yml's own step order.
 *
 * Deliberately NOT applied to removedDeclarations/removedProperties: confirming a removal was
 * truly public would need the PREVIOUS release's own dist output, which isn't checked in and
 * isn't worth reconstructing here -- staying conservative (source-level heuristic only) for
 * removals is the safer direction to be wrong in.
 */
export function publicEntryDtsText(packageDirectory) {
	// resolve() (not join()) so an already-absolute packageDirectory -- a real test fixture
	// outside this repo entirely -- is honored as-is instead of being appended onto REPO_ROOT.
	const packageRoot = resolve(REPO_ROOT, packageDirectory);
	const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
	const dtsPaths = new Set();
	if (typeof manifest.types === "string") dtsPaths.add(manifest.types);
	for (const target of Object.values(manifest.exports ?? {})) {
		if (typeof target === "object" && target !== null && typeof target.types === "string") dtsPaths.add(target.types);
	}
	return [...dtsPaths]
		.map((relative) => join(packageRoot, relative))
		.filter((absolute) => existsSync(absolute))
		.map((absolute) => readFileSync(absolute, "utf8"))
		.join("\n");
}

function declarationNames(lines, prefix) {
	const names = new Set();
	const pattern = new RegExp(
		`^\\${prefix}export\\s+(?:declare\\s+)?(?:abstract\\s+)?(?:class|function|interface|type|const|enum)\\s+([A-Za-z_$][\\w$]*)`,
	);
	for (const line of lines) {
		const match = line.match(pattern);
		if (match?.[1]) names.add(match[1]);
	}
	return names;
}

const EXPORT_BLOCK_OPEN_PATTERN = /^export\s+(?:interface\s+(\w+)|type\s+(\w+)\s*=)\b/;

/** Hunk header ("@@ -a,b +c,d @@ ...") or file header ("diff --git a/x b/y") -- the two places
 * a `--unified=0` diff jumps to an unrelated location with no context to show the seam. */
const DIFF_BOUNDARY_PATTERN = /^(?:@@ |diff --git )/;

/**
 * Scoped to an actual exported interface/type-literal body -- an unexported function's own
 * multi-line parameter list (one param per line, e.g. after a Biome reformat) matches the
 * bare `name: Type` shape just as well as a real interface property, with nothing in the
 * original unscoped version to tell them apart. Tracks brace depth across each diff hunk's own
 * lines and only counts a `${prefix}` line while depth is at or below the level an `export
 * interface`/`export type =` line's own opening brace introduced.
 *
 * Explicitly resets at every hunk/file boundary (see DIFF_BOUNDARY_PATTERN) rather than
 * tracking depth continuously across the whole diff: with `--unified=0` there is no
 * surrounding context, so two hunks from unrelated locations in the file (or in different
 * files entirely) sit back-to-back in `lines` with nothing to show where one scope actually
 * closes. Treating that seam as if it were contiguous code let an interface opened in one
 * hunk (never closed within that same hunk's visible lines) silently keep "exportedAtDepth"
 * active into a later, unrelated hunk -- e.g. a private method's own multi-line parameter
 * list several hundred lines away got misread as that interface's own properties. Confirmed
 * live releasing vehicle-server 0.20.0: a purely additive change (new optional interface
 * fields, a method signature consolidating existing params into one) was flagged as removing
 * required properties named after the method's own now-removed parameter names.
 */
/**
 * Returns Map<propertyName, Set<ownerTypeName>> rather than a flat name Set -- a bare property
 * name ("port", "id", ...) collides too easily with an unrelated, pre-existing property of the
 * SAME name on a genuinely public interface elsewhere in the package, which would make a
 * publicDts.includes(name) check in main() pass for entirely the wrong reason. Tracking which
 * interface/type-alias each property actually belongs to lets main() ask the precise question:
 * is the interface this property was added TO itself part of the public surface, not just does
 * this property name happen to appear somewhere in it.
 */
function propertyOwners(lines, prefix, requiredOnly) {
	const owners = new Map();
	const optional = requiredOnly ? "" : "[?]?";
	const propertyPattern = new RegExp(`^\\s*(?:readonly\\s+)?([A-Za-z_$][\\w$]*)${optional}\\s*:`);
	let depth = 0;
	let exportedAtDepth = null;
	let currentOwner = null;
	for (const rawLine of lines) {
		if (DIFF_BOUNDARY_PATTERN.test(rawLine)) {
			depth = 0;
			exportedAtDepth = null;
			currentOwner = null;
			continue;
		}
		const marker = rawLine.length > 0 ? rawLine[0] : " ";
		const content = rawLine.length > 0 ? rawLine.slice(1) : "";
		const blockMatch = exportedAtDepth === null ? content.match(EXPORT_BLOCK_OPEN_PATTERN) : null;
		const opensExportBlock = blockMatch !== null && content.includes("{");
		if (marker === prefix && exportedAtDepth !== null && depth >= exportedAtDepth) {
			const match = content.match(propertyPattern);
			if (match?.[1] && (!requiredOnly || !content.includes(`${match[1]}?`))) {
				if (!owners.has(match[1])) owners.set(match[1], new Set());
				owners.get(match[1]).add(currentOwner);
			}
		}
		const opens = (content.match(/\{/g) ?? []).length;
		const closes = (content.match(/\}/g) ?? []).length;
		if (opensExportBlock) {
			exportedAtDepth = depth + 1;
			currentOwner = blockMatch[1] ?? blockMatch[2] ?? null;
		}
		depth += opens - closes;
		if (exportedAtDepth !== null && depth < exportedAtDepth) {
			exportedAtDepth = null;
			currentOwner = null;
		}
	}
	return owners;
}

function propertyNames(lines, prefix, requiredOnly) {
	return new Set(propertyOwners(lines, prefix, requiredOnly).keys());
}

/** name -> the set of exported interface/type-alias names it was added under, across the whole
 * diff -- main()'s own public-surface filter for addedRequiredProperties. */
export function addedRequiredPropertyOwners(diff) {
	const lines = diff.split("\n").filter((line) => !line.startsWith("---") && !line.startsWith("+++"));
	return propertyOwners(lines, "+", true);
}

export function findBreakingTypeCandidates(diff) {
	const lines = diff.split("\n").filter((line) => !line.startsWith("---") && !line.startsWith("+++"));
	const removedDeclarations = declarationNames(lines, "-");
	const addedDeclarations = declarationNames(lines, "+");
	const removedProperties = propertyNames(lines, "-", false);
	const addedProperties = propertyNames(lines, "+", false);
	const addedRequiredProperties = propertyNames(lines, "+", true);
	return {
		removedDeclarations: [...removedDeclarations].filter((name) => !addedDeclarations.has(name)),
		removedProperties: [...removedProperties].filter((name) => !addedProperties.has(name)),
		addedRequiredProperties: [...addedRequiredProperties].filter((name) => !removedProperties.has(name)),
	};
}

function parseVersion(version) {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
	if (!match) throw new Error(`invalid package version: ${version}`);
	return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function enforceReleaseDiscipline({ previousVersion, currentVersion, candidates, releaseMessage }) {
	const breaking = Object.values(candidates).some((names) => names.length > 0);
	if (!breaking) return;
	const previous = parseVersion(previousVersion);
	const current = parseVersion(currentVersion);
	if (previous.major > 0 && current.major <= previous.major) {
		throw new Error(`breaking public type candidates require a major version bump after 1.0 (${previousVersion} -> ${currentVersion})`);
	}
	if (previous.major === 0 && !releaseMessage.includes("BREAKING CHANGE:")) {
		throw new Error("pre-1.0 breaking public type candidates require a BREAKING CHANGE: note in the release commit");
	}
}

function main() {
	const tag = process.env.GITHUB_REF_NAME ?? "";
	const entry = [...PACKAGES.entries()].find(([name]) => tag.startsWith(`${name}-v`));
	if (!entry) return;
	const [packageName, packageDirectory] = entry;
	const currentVersion = tag.slice(`${packageName}-v`.length);
	const packageVersion = JSON.parse(git(["show", `HEAD:${packageDirectory}/package.json`])).version;
	if (currentVersion !== packageVersion) throw new Error(`tag ${currentVersion} does not match package version ${packageVersion}`);
	const previousTag = git(["tag", "--sort=-v:refname", "--list", `${packageName}-v*`])
		.split("\n")
		.find((candidate) => candidate && candidate !== tag);
	if (!previousTag) return;
	const previousVersion = previousTag.slice(`${packageName}-v`.length);
	const diff = git(["diff", "--unified=0", `${previousTag}..HEAD`, "--", `${packageDirectory}/src`]);
	const candidates = findBreakingTypeCandidates(diff);
	const publicDts = publicEntryDtsText(packageDirectory);
	if (publicDts) {
		const owners = addedRequiredPropertyOwners(diff);
		candidates.addedRequiredProperties = candidates.addedRequiredProperties.filter((name) => {
			const ownerTypes = owners.get(name);
			// No recorded owner (shouldn't happen -- addedRequiredProperties came from the exact
			// same scan) stays conservative and keeps the candidate flagged rather than dropping it.
			if (!ownerTypes || ownerTypes.size === 0) return true;
			return [...ownerTypes].some((owner) => owner && publicDts.includes(owner));
		});
	}
	enforceReleaseDiscipline({ previousVersion, currentVersion, candidates, releaseMessage: git(["log", "-1", "--format=%B"]) });
}

if (import.meta.url === `file://${process.argv[1]}`) main();
