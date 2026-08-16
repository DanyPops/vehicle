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
import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
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
import {
	applyShellActivation,
	cachedAggregatedOperations,
	discoverAllVehicles,
	namespacedOperationsOf,
	type VehicleShellHandle,
} from "./state.js";

export function createToolsListTool(listToolName: string, manToolName: string, handle: VehicleShellHandle): ToolDefinition {
	return {
		name: listToolName,
		label: "List Tools",
		description: `Lists every registered Vehicle's own operations, one line each, namespaced "<vehicle>:<operation>" (e.g. "papyrus:tasks.create"). Optionally filter by a keyword matched against the name and description, and/or by effect (${VEHICLE_EFFECTS.join(" | ")}) -- e.g. effect:"read" to browse only side-effect-free operations first. mode:"regex" treats query as a case-insensitive regular expression instead of a plain substring/prefix match (apropos's own default matching mode). scope:"name" restricts matching to the name alone, skipping the description. verbosity:"high" adds each match's own parameter/schema summary, avoiding a separate ${manToolName} round trip when browsing several operations' shape at once. Use ${manToolName} on a name from this list (or any name you already know) to see its full documentation (permissions/effect/idempotency too) and make it callable.`,
		parameters: Type.Object({
			query: Type.Optional(
				Type.String({ description: "Keyword to filter by (matched against operation name and description); omit to list everything." }),
			),
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
		async execute(_toolCallId, params) {
			const {
				query = "",
				mode = "substring",
				effect,
				scope = "all",
				verbosity = "low",
			} = params as {
				query?: string;
				mode?: "substring" | "regex";
				effect?: VehicleEffect;
				scope?: ShellQueryScope;
				verbosity?: "low" | "high";
			};
			reportToolsListExecute("vehicle", query);
			const operations = await cachedAggregatedOperations(handle, handle.aggregateCacheTtlMs);

			let score: (descriptor: VehicleOperationDescriptor) => number | undefined;
			if (mode === "regex") {
				let regex: RegExp;
				try {
					regex = compileShellQueryRegex(query);
				} catch (error) {
					// Never an uncaught exception into the tool-calling harness -- an invalid regex is a
					// normal, expected user input, not a bug.
					return {
						content: [{ type: "text", text: `Invalid regex "${query}": ${error instanceof Error ? error.message : String(error)}` }],
						details: {},
					};
				}
				score = (descriptor) => regexQueryScore(descriptor, regex, scope);
			} else {
				score = (descriptor) => shellQueryScore(descriptor, query, scope);
			}

			const matches = operations
				.flatMap((descriptor, index) => {
					if (effect !== undefined && descriptor.effect !== effect) return [];
					const thisScore = score(descriptor);
					return thisScore === undefined ? [] : [{ descriptor, index, score: thisScore }];
				})
				.sort((left, right) => left.score - right.score || left.index - right.index)
				.map((entry) => entry.descriptor);
			const formatMatch = verbosity === "high" ? formatOperationOneLinerVerbose : formatOperationOneLiner;
			const text =
				matches.length === 0
					? `No operations matched "${query}"${effect ? ` with effect "${effect}"` : ""}.`
					: matches.map((descriptor) => formatMatch(descriptor)).join("\n");
			return {
				content: [{ type: "text", text }],
				details: { operations: matches.map((descriptor) => ({ name: descriptor.name, description: descriptor.description })) },
			};
		},
	};
}

export function createToolsManTool(
	pi: ExtensionAPI,
	listToolName: string,
	manToolName: string,
	handle: VehicleShellHandle,
	discoveredTtlTurns: number,
): ToolDefinition {
	return {
		name: manToolName,
		label: "Tool Manual",
		description: `Shows full documentation for one or more Vehicle operations by their exact namespaced name (as seen from ${listToolName} or already known) and makes each one callable starting next turn. A name doesn't need to have been listed first. A bare, unprefixed name (no "vehicle:" part) also resolves as long as exactly one vehicle provides it -- ambiguous across more than one vehicle refuses and lists every real candidate instead of guessing.`,
		parameters: Type.Object({
			names: Type.Array(Type.String(), {
				description: 'Exact operation name(s), namespaced ("papyrus:tasks.create") or bare ("tasks.create") when unambiguous.',
				minItems: 1,
			}),
		}),
		async execute(_toolCallId, params) {
			const names = (params as { names: string[] }).names;
			reportToolsManExecute("vehicle", names);
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

			const pages = await Promise.all(
				names.map(async (name) => {
					const resolved = resolveOperationName(name, allOperations);
					if (resolved.kind === "none") return `${name}: no such operation. Use ${listToolName} to browse available names.`;
					if (resolved.kind === "ambiguous") {
						return `${name}: ambiguous -- provided by ${resolved.candidates.length} vehicles (${resolved.candidates.join(", ")}). Use one of these exact names instead.`;
					}
					const { vehicleName, operationName, descriptor: namespaced } = resolved;
					const fullName = `${vehicleName}:${operationName}`;
					const vehicle = byVehicleName.get(vehicleName);
					if (!vehicle) return `${fullName}: no such operation. Use ${listToolName} to browse available names.`;
					const seeAlso = relatedOperationNames(vehicleName, operationName, allOperations);

					const managed = byKey.get(fullName);
					if (managed) {
						if (!managed.available) return `${fullName}: currently unavailable (${manToolName} cannot activate it right now).`;
						if (managed.blocked) return `${fullName}: blocked by the current safety policy -- not activatable.`;
						handle.tracker.seed(managed.toolName, discoveredTtlTurns);
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
					handle.managedTools = [...handle.managedTools, { vehicleName, toolName, operationName, available: true, blocked: false }];
					handle.tracker.seed(toolName, discoveredTtlTurns);
					return `${formatOperationManPage(namespaced, toolName, seeAlso)}\n\n(now callable as ${toolName})`;
				}),
			);
			applyShellActivation(pi, handle);
			return { content: [{ type: "text", text: pages.join("\n\n---\n\n") }], details: {} };
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
		description: `Reports how each name currently resolves -- "active" (callable right now, with the real toolName and turns remaining before it decays), "dormant" (known, needs ${manToolName} to activate), "blocked" (known but currently unavailable or blocked by safety policy), "unreachable" (a namespaced name whose vehicle used to be known but produces nothing live right now), "ambiguous" (a bare name matching more than one vehicle -- use one of the listed full names), or "unknown" (no such operation anywhere currently discoverable). Read-only -- unlike ${manToolName}, never activates anything or extends any TTL, so calling this never changes what's callable.`,
		parameters: Type.Object({
			names: Type.Array(Type.String(), {
				description: 'Exact or bare operation name(s), e.g. "papyrus:tasks.create" or "tasks.create".',
				minItems: 1,
			}),
		}),
		async execute(_toolCallId, params) {
			const names = (params as { names: string[] }).names;
			// Same as tools_man: deliberately always fresh, never tools_list's own cache -- a status check
			// that itself lags reality would defeat its whole diagnostic purpose.
			const vehicles = await discoverAllVehicles();
			const allOperations = await namespacedOperationsOf(vehicles);
			const results = names.map((name) => ({
				name,
				result: classifyOperationName(name, allOperations, handle.managedTools, handle.tracker),
			}));
			const text = results.map(({ name, result }) => formatOperationTypeLine(name, result, manToolName, listToolName)).join("\n");
			return {
				content: [{ type: "text", text }],
				details: { results: results.map(({ name, result }) => ({ name, ...result })) },
			};
		},
	};
}
