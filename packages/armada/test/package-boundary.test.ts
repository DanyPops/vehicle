import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "@danypops/armada/cli";
import { createArmadaTestHarness } from "@danypops/armada/testing";

describe("published package boundary", () => {
	it("exports the CLI, testing harness, and executable entry point", async () => {
		expect(runCli).toBeTypeOf("function");
		expect(createArmadaTestHarness).toBeTypeOf("function");
		const cliUrl = new URL("../dist/cli.js", import.meta.url);
		expect(await readFile(cliUrl, "utf8")).toMatch(/^#!\/usr\/bin\/env node/);
		if (process.platform !== "win32") expect((await stat(cliUrl)).mode & 0o111).not.toBe(0);
	});

	it("executes the built CLI through an installed bin symlink", async () => {
		const directory = await mkdtemp(join(tmpdir(), "armada-bin-"));
		try {
			const binPath = join(directory, "armada");
			await symlink(fileURLToPath(new URL("../dist/cli.js", import.meta.url)), binPath);
			const child = Bun.spawn([process.execPath, binPath, "unknown"], { stdout: "pipe", stderr: "pipe" });
			expect(await child.exited).toBe(2);
			expect(await new Response(child.stderr).text()).toContain("CLI_COMMAND_UNKNOWN");
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
