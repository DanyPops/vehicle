/**
 * The 3 dynamic Pi tool factories behind the Vehicle Shell: tools_list/tools_man/tools_type.
 * Split out of vehicle-shell.ts's own bundled concerns.
 */

import {
	VEHICLE_EFFECTS,
	type VehicleEffect,
	type VehicleManifestOperation,
	type VehicleOperationDescriptor,
} from "@danypops/vehicle-core";
import type { ExtensionAPI, ExtensionContext, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Check } from "typebox/value";
import { reportToolsListExecute, reportToolsManExecute } from "../client-diagnostics.js";
import {
	compileShellQueryRegex,
	formatOperationManPage,
	formatOperationOneLiner,
	formatOperationOneLinerVerbose,
	regexQueryScore,
	relatedOperationNames,
	type ShellQueryScope,
	shellQueryScore,
} from "./formatting.js";
import { classifyOperationName, formatOperationTypeLine, resolveOperationName } from "./name-resolution.js";
import { boundShellText, pageShellOperations, shellInputError, shellNamesSchema } from "./output-bounds.js";
import {
	applyShellActivation,
	cachedAggregatedOperations,
	discoverAllVehicles,
	namespacedOperationsOf,
	type VehicleShellHandle,
} from "./state.js";
import { estimateToolWeightTokens } from "./tool-weight.js";
import { reportableVehiclesByName, reportShellToolUsageToAllDiscovered, safeReportShellToolUsage } from "./usage-reporting.js";

export function createToolsListTool(listToolName: string, manToolName: string, handle: VehicleShellHandle): ToolDefinition {
	const tool: ToolDefinition = {
		name: listToolName,
		label: "List Tools",
		description: `Finds Vehicle operations as vehicle:operation names, without activation. Defaults: 50 results, 16 KiB full response. Filter by query, vehicle, namespace or effect; regex mode is case-insensitive, scope:name searches names only. High verbosity includes parameter summaries. Follow the returned cursor with the same filters; restart on stale-cursor. Summaries may be truncated. Use ${manToolName} to read a manual and activate exact names.`,
		parameters: Type.Object({
			vehicle: Type.Optional(Type.String({ minLength: 1, maxLength: 64, description: "Exact Vehicle name." })),
			namespace: Type.Optional(
				Type.String({ minLength: 1, maxLength: 128, description: "Operation namespace, e.g. tasks or subscription.resets." }),
			),
			limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
			maxBytes: Type.Optional(
				Type.Integer({
					minimum: 1024,
					maximum: 65536,
					default: 16384,
					description: "Full UTF-8 JSON response ceiling, including details.",
				}),
			),
			cursor: Type.Optional(
				Type.String({ maxLength: 80, description: "Continuation from this catalog and the same filters; restart if stale." }),
			),
			query: Type.Optional(Type.String({ maxLength: 512, description: "Keyword matched against name and description." })),
			mode: Type.Optional(
				Type.Union([Type.Literal("substring"), Type.Literal("regex")], {
					description:
						'"substring" (default): today\'s plain substring/prefix match. "regex": treat query as a case-insensitive regular expression instead, matched against name and description independently.',
				}),
			),
			effect: Type.Optional(
				Type.Union(
					VEHICLE_EFFECTS.map((value) => Type.Literal(value)),
					{
						description:
							"Restrict to operations with exactly this effect classification; omit to list every effect (today's default). Combines with query as AND, not a replacement for it.",
					},
				),
			),
			scope: Type.Optional(
				Type.Union([Type.Literal("all"), Type.Literal("name")], {
					description:
						'"all" (default): match query against name OR description, today\'s exact existing behavior. "name": match against the operation name only (apropos --names-only parity).',
				}),
			),
			verbosity: Type.Optional(
				Type.Union([Type.Literal("low"), Type.Literal("high")], {
					description:
						'"low" (default): today\'s exact one-liner-per-match output. "high": each match\'s one-liner plus its parameter/schema summary.',
				}),
			),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx: ExtensionContext) {
			const startedAt = Date.now();
			const callerSessionId = ctx?.sessionManager?.getSessionId();
			const callerProjectRoot = ctx?.cwd;
			const report = (outcome: "success" | "failure") =>
				reportShellToolUsageToAllDiscovered(
					discoverAllVehicles,
					"tools_list",
					outcome,
					Date.now() - startedAt,
					callerSessionId,
					callerProjectRoot,
				);
			try {
				if (!Check(tool.parameters, params)) {
					report("failure");
					return shellInputError();
				}
				const {
					vehicle,
					namespace,
					limit = 50,
					maxBytes = 16_384,
					cursor,
					query = "",
					mode = "substring",
					effect,
					scope = "all",
					verbosity = "low",
				} = params as {
					vehicle?: string;
					namespace?: string;
					limit?: number;
					maxBytes?: number;
					cursor?: string;
					query?: string;
					mode?: "substring" | "regex";
					effect?: VehicleEffect;
					scope?: ShellQueryScope;
					verbosity?: "low" | "high";
				};
				reportToolsListExecute("vehicle", query);
				_signal?.throwIfAborted();
				const operations = await cachedAggregatedOperations(handle, handle.aggregateCacheTtlMs);
				_signal?.throwIfAborted();

				let score: (descriptor: VehicleOperationDescriptor) => number | undefined;
				if (mode === "regex") {
					let regex: RegExp;
					try {
						regex = compileShellQueryRegex(query);
					} catch (error) {
						// Never an uncaught exception into the tool-calling harness -- an invalid regex is a
						// normal, expected user input, not a bug.
						report("success");
						return {
							content: [
								{
									type: "text",
									text: boundShellText(`Invalid regex "${query}": ${error instanceof Error ? error.message : String(error)}`, 128),
								},
							],
							details: {},
						};
					}
					score = (descriptor) => regexQueryScore(descriptor, regex, scope);
				} else {
					score = (descriptor) => shellQueryScore(descriptor, query, scope);
				}

				const matches = operations
					.flatMap((descriptor, index) => {
						const separator = descriptor.name.indexOf(":");
						if (vehicle !== undefined && descriptor.name.slice(0, separator) !== vehicle) return [];
						if (namespace !== undefined && !descriptor.name.slice(separator + 1).startsWith(`${namespace}.`)) return [];
						if (effect !== undefined && descriptor.effect !== effect) return [];
						const thisScore = score(descriptor);
						return thisScore === undefined ? [] : [{ descriptor, index, score: thisScore }];
					})
					.sort((left, right) => left.score - right.score || left.index - right.index)
					.map((entry) => entry.descriptor);
				const formatMatch = verbosity === "high" ? formatOperationOneLinerVerbose : formatOperationOneLiner;
				const result = pageShellOperations(
					matches,
					{ limit, maxBytes, cursor, filterKey: JSON.stringify({ query, mode, effect, scope, verbosity, vehicle, namespace }) },
					formatMatch,
				);
				if (matches.length === 0 && !("isError" in result))
					result.content[0]!.text = boundShellText(`No operations matched "${query}"${effect ? ` with effect "${effect}"` : ""}.`, 128);
				report("isError" in result ? "failure" : "success");
				return result;
			} catch (error) {
				report("failure");
				throw error;
			}
		},
	};
	return tool;
}

export function createToolsManTool(
	pi: ExtensionAPI,
	listToolName: string,
	manToolName: string,
	handle: VehicleShellHandle,
): ToolDefinition {
	return {
		name: manToolName,
		label: "Tool Manual",
		description: `Reads bounded manuals and activates up to 16 Vehicle operations for the next turn. Use exact vehicle:operation names from ${listToolName}, or unambiguous bare names. Ambiguous, unavailable and policy-blocked names are refused. Response ceiling: 64 KiB; oversized manuals carry explicit truncation markers.`,
		parameters: shellNamesSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx: ExtensionContext) {
			const startedAt = Date.now();
			const callerSessionId = ctx?.sessionManager?.getSessionId();
			const callerProjectRoot = ctx?.cwd;
			if (!Check(shellNamesSchema, params)) return shellInputError();
			const names = (params as { names: string[] }).names;
			reportToolsManExecute("vehicle", names);
			_signal?.throwIfAborted();
			const byKey = new Map(handle.managedTools.map((tool) => [`${tool.vehicleName}:${tool.operationName}`, tool]));
			const vehicles = await discoverAllVehicles();
			const byVehicleName = new Map(vehicles.map((vehicle) => [vehicle.name, vehicle]));
			// Computed once for the whole batch, feeding both the fully-namespaced lookup (replacing the
			// old per-name single-vehicle client.manifest() call with the exact same "fresh, fallback to
			// snapshot on failure" semantics namespacedOperationsOf already provides -- and avoiding a
			// redundant re-fetch of the same vehicle when a batch names more than one of its operations)
			// and bare-name resolution across every vehicle. Deliberately NEVER goes through tools_list's
			// own cachedAggregatedOperations -- activation/documentation is consequential enough (and rare
			// enough per turn) that it must always see live state, never something up to a TTL window stale.
			const allOperations = await namespacedOperationsOf(vehicles);
			_signal?.throwIfAborted();

			const touchedVehicleNames = new Set<string>();
			const pages = await Promise.all(
				names.map(async (name) => {
					const resolved = resolveOperationName(name, allOperations);
					if (resolved.kind === "none") return `${name}: no such operation. Use ${listToolName} to browse available names.`;
					if (resolved.kind === "ambiguous") {
						return `${name}: ambiguous -- provided by ${resolved.candidates.length} vehicles (${resolved.candidates.join(", ")}). Use one of these exact names instead.`;
					}
					touchedVehicleNames.add(resolved.vehicleName);
					const { vehicleName, operationName, descriptor: namespaced } = resolved;
					const fullName = `${vehicleName}:${operationName}`;
					const vehicle = byVehicleName.get(vehicleName);
					if (!vehicle) return `${fullName}: no such operation. Use ${listToolName} to browse available names.`;
					const seeAlso = relatedOperationNames(vehicleName, operationName, allOperations);

					const managed = byKey.get(fullName);
					if (managed) {
						if (!managed.available) return `${fullName}: currently unavailable (${manToolName} cannot activate it right now).`;
						if (managed.blocked) return `${fullName}: blocked by the current safety policy -- not activatable.`;
						// Always the real, computed weight -- namespaced carries this operation's own live
						// description/inputSchema, so there's never a need for a fallback here the way
						// refreshVehicleShellManagedTools sometimes must (a hand-built test fixture).
						handle.tracker.seed(
							managed.toolName,
							estimateToolWeightTokens({ name: managed.toolName, description: namespaced.description, parameters: namespaced.inputSchema }),
						);
						return `${formatOperationManPage(namespaced, managed.toolName, seeAlso)}\n\n(now callable as ${managed.toolName})`;
					}

					const activateOperation = "activateOperation" in vehicle ? vehicle.activateOperation : undefined;
					if (!activateOperation) {
						return `${fullName}: known -- provided by Vehicle "${vehicleName}", discovered live via the shared Vehicle Handle Directory. Cross-process activation isn't wired here; not yet callable in this process.`;
					}
					// activateOperation needs the vehicle's own RAW (un-namespaced) descriptor -- `namespaced.name`
					// is "vehicle:operation", but activation/dispatch always uses the vehicle's own bare name.
					const rawDescriptor: VehicleManifestOperation = { ...namespaced, name: operationName };
					let toolName: string;
					try {
						toolName = activateOperation(rawDescriptor);
					} catch (error) {
						return `${fullName}: could not activate -- ${error instanceof Error ? error.message : String(error)}.`;
					}
					const weightTokens = estimateToolWeightTokens({
						name: toolName,
						description: namespaced.description,
						parameters: namespaced.inputSchema,
					});
					handle.managedTools = [
						...handle.managedTools,
						{ vehicleName, toolName, operationName, available: true, blocked: false, weightTokens },
					];
					handle.tracker.seed(toolName, weightTokens);
					return `${formatOperationManPage(namespaced, toolName, seeAlso)}\n\n(now callable as ${toolName})`;
				}),
			);
			applyShellActivation(pi, handle);
			safeReportShellToolUsage(
				reportableVehiclesByName(vehicles, touchedVehicleNames),
				"tools_man",
				"success",
				Date.now() - startedAt,
				callerSessionId,
				callerProjectRoot,
			);
			const bounded = pages.map((page) => boundShellText(page, Math.floor(9_000 / pages.length)));
			return {
				content: [{ type: "text", text: bounded.join("\n\n---\n\n") }],
				details: { truncated: bounded.some((page, index) => page !== pages[index]) },
			};
		},
	};
}

export function createToolsTypeTool(
	listToolName: string,
	manToolName: string,
	typeToolName: string,
	handle: VehicleShellHandle,
): ToolDefinition {
	return {
		name: typeToolName,
		label: "Tool Type",
		description: `Inspects up to 16 exact or bare operation names without activation or eviction: active, dormant, blocked, unreachable, ambiguous or unknown. Active results include the Pi tool name, estimated token weight and eviction priority. Use ${manToolName} to activate dormant tools. Response ceiling: 64 KiB; narrow the batch on output-budget-exceeded.`,
		parameters: shellNamesSchema,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx: ExtensionContext) {
			const startedAt = Date.now();
			const callerSessionId = ctx?.sessionManager?.getSessionId();
			const callerProjectRoot = ctx?.cwd;
			if (!Check(shellNamesSchema, params)) return shellInputError();
			const names = (params as { names: string[] }).names;
			// Same as tools_man: deliberately always fresh, never tools_list's own cache -- a status check
			// that itself lags reality would defeat its whole diagnostic purpose.
			_signal?.throwIfAborted();
			const vehicles = await discoverAllVehicles();
			const allOperations = await namespacedOperationsOf(vehicles);
			_signal?.throwIfAborted();
			const results = names.map((name) => ({
				name,
				result: classifyOperationName(name, allOperations, handle.managedTools, handle.tracker),
			}));
			const text = results.map(({ name, result }) => formatOperationTypeLine(name, result, manToolName, listToolName)).join("\n");
			// Read-only, so "which vehicle(s) did this touch" is re-derived independently of
			// classifyOperationName's own richer result shape (most branches don't carry vehicleName).
			const touchedVehicleNames = new Set(
				names.flatMap((name) => {
					const resolved = resolveOperationName(name, allOperations);
					return resolved.kind === "unique" ? [resolved.vehicleName] : [];
				}),
			);
			safeReportShellToolUsage(
				reportableVehiclesByName(vehicles, touchedVehicleNames),
				"tools_type",
				"success",
				Date.now() - startedAt,
				callerSessionId,
				callerProjectRoot,
			);
			const response = {
				content: [{ type: "text" as const, text }],
				details: { results: results.map(({ name, result }) => ({ name, ...result })), truncated: false },
			};
			return Buffer.byteLength(JSON.stringify(response)) <= 65_536 ? response : shellInputError("output-budget-exceeded");
		},
	};
}
