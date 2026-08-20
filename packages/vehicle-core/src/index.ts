/**
 * Vehicle's runtime-neutral wire contract, organized by capability (see each
 * subfolder's own index.ts) rather than one flat forest of vehicle-*.ts files:
 * schemas (codecs, loose-object validation, credential presentation), content
 * (model-facing narrative blocks), operations (descriptors, effect
 * classification, invocation context), events, manifest, client (the port a
 * caller programs against), approvals (the Approval Gate's wire shapes), jobs
 * (Vehicle Jobs' pure pieces), schedules, watches, persistence (atomic
 * JSON), concurrency (timer-based scheduling primitives), and cli-safety
 * (argv-injection guards for any operation shelling out to a CLI) -- the
 * latter three are technical utilities, not Vehicle protocol capabilities,
 * kept distinct for that reason. Every symbol below is re-exported unchanged
 * from its historical flat-file home, so root-level `import { X } from
 * "@danypops/vehicle-core"` usage is completely unaffected by this layout.
 */
export * from "./approvals/index.js";
export * from "./cli-safety/index.js";
export * from "./client/index.js";
export * from "./concurrency/index.js";
export * from "./content/index.js";
export * from "./errors/index.js";
export * from "./events/index.js";
export * from "./idempotency/index.js";
export * from "./jobs/index.js";
export * from "./manifest/index.js";
export * from "./operations/index.js";
export * from "./persistence/index.js";
export * from "./schedules/index.js";
export * from "./schemas/index.js";
export * from "./watches/index.js";
