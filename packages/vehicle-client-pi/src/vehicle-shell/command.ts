import { randomUUID } from "node:crypto";
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { shellInputError } from "./output-bounds.js";

type ShellCommands = Record<"list" | "man" | "type", ToolDefinition>;
const usage = [
	"/vehicle-tools <list|man|type> [--json] <JSON object>",
	"/vehicle-tools help [--json]",
	"Runs session-local meta-tools, rather than daemon operations. man activates tools in the owning Pi process; a separate CLI process controls only itself.",
	'Example: /vehicle-tools list --json {"vehicle":"example","limit":10}',
	"Headless: pi --mode json --print '/vehicle-tools list --json {\"limit\":10}'",
	"--json returns the native result envelope; help --json includes the shared input schemas. Input ceiling: 8 KiB. Results retain native bounds and continuation metadata.",
].join("\n");
const failure = (code: string, text: string) => ({ isError: true, content: [{ type: "text" as const, text }], details: { code } });

/** Exposes the owning session's shell handlers through Pi's command dispatcher. */
export function registerShellCommand(pi: ExtensionAPI, tools: ShellCommands): void {
	let active: AbortController | undefined;
	let closed = false;
	let owner = Symbol();
	pi.on("session_start", () => {
		active?.abort();
		active = undefined;
		owner = Symbol();
		closed = false;
	});
	pi.on("session_shutdown", () => {
		closed = true;
		active?.abort();
	});
	pi.registerCommand("vehicle-tools", {
		description: "List, document/activate, or inspect this session's Vehicle tools; use help for JSON syntax.",
		async handler(args, ctx) {
			const commandOwner = owner;
			const json = /^\s*\w+\s+--json(?:\s|$)/.test(args.slice(0, 8192));
			const publish = (result: Awaited<ReturnType<ToolDefinition["execute"]>>) => {
				if (!closed && commandOwner === owner)
					pi.sendMessage(
						{ customType: "vehicle-shell-command", content: json ? JSON.stringify(result) : result.content, display: true },
						{ triggerTurn: false },
					);
			};
			if (closed) return;
			if (Buffer.byteLength(args, "utf8") > 8192) {
				publish(shellInputError());
				return;
			}
			const match = /^\s*(\w+)?(?:\s+(--json))?(?:\s+([\s\S]+))?\s*$/.exec(args);
			if (!match) {
				publish(shellInputError());
				return;
			}
			const action = match[1] ?? "help";
			if (action === "help" && !match[3]) {
				publish({
					content: [{ type: "text", text: usage }],
					details: {
						scope: "pi-session",
						operations: Object.fromEntries(
							Object.entries(tools).map(([name, tool]) => [name, { name: tool.name, parameters: tool.parameters }]),
						),
					},
				});
				return;
			}
			if (!Object.hasOwn(tools, action)) {
				publish(shellInputError());
				return;
			}
			let input: unknown;
			try {
				input = JSON.parse(match[3] ?? "{}");
			} catch {
				publish(shellInputError());
				return;
			}
			if (active || !ctx.isIdle()) {
				publish(failure("shell-busy", "Wait for the current operation or agent turn to finish, then retry."));
				return;
			}
			const controller = new AbortController();
			active = controller;
			try {
				const result = await tools[action as keyof ShellCommands].execute(
					`shell-command:${randomUUID()}`,
					input as never,
					controller.signal,
					undefined,
					ctx,
				);
				publish(result);
			} catch {
				publish(failure("shell-command-failed", "Shell operation failed; inspect service availability and retry."));
			} finally {
				if (active === controller) active = undefined;
			}
		},
	});
}
