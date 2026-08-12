import { fileURLToPath } from "node:url";

/** Resolves a real installed npm extension package's subpath file -- packages without a "main"/"exports" field (e.g. @danypops/pi-papyrus) still resolve fine via a direct subpath specifier as long as nothing declares an "exports" map restricting it. */
export function resolveRealExtensionPath(packageSubpath: string): string {
	return fileURLToPath(import.meta.resolve(packageSubpath));
}
