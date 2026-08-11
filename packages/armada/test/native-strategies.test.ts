import { describe, expect, it } from "bun:test";
import { launchdStrategy, type NativeServiceStrategy, systemdStrategy, windowsTaskSchedulerStrategy } from "../src/index.js";
import { vehicle } from "./fixtures.js";

const strategies: readonly NativeServiceStrategy[] = [systemdStrategy, launchdStrategy, windowsTaskSchedulerStrategy];

describe("native service strategies", () => {
	it("generate deterministic Armada-owned identities and descriptors", () => {
		for (const strategy of strategies) {
			const spec = vehicle({ restart: { policy: "never" } });
			const first = strategy.generateDescriptor(spec);
			const second = strategy.generateDescriptor(spec);
			expect(first).toEqual(second);
			expect(first.ok).toBe(true);
			if (!first.ok) continue;
			expect(first.descriptor.kind).toBe(strategy.kind);
			expect(first.descriptor.specHash).toMatch(/^[a-f0-9]{64}$/);
			expect(first.descriptor.content).toContain(first.descriptor.specHash);
		}
	});

	it("maps bounded restart and resource controls to a systemd user unit", () => {
		const outcome = systemdStrategy.generateDescriptor(
			vehicle({
				executable: "/opt/Armada Vehicle/papyrus",
				arguments: ["serve", "a value"],
				workingDirectory: "/var/lib/papyrus",
				resources: {
					memoryHighBytes: { value: 201_326_592, enforcement: "required" },
					maximumMemoryBytes: { value: 268_435_456, enforcement: "required" },
					maximumCpuPercent: { value: 75, enforcement: "required" },
					maximumTasks: { value: 32, enforcement: "required" },
				},
				runtime: {
					preventPrivilegeEscalation: { enforcement: "required" },
					privateTemporaryDirectory: { enforcement: "required" },
					networkReadiness: { enforcement: "required" },
				},
			}),
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(String(outcome.descriptor.identity)).toBe("armada-papyrus.service");
		expect(outcome.descriptor.fileName).toBe("armada-papyrus.service");
		expect(outcome.descriptor.content).toContain('Environment="VEHICLE_LAUNCH_PROVENANCE=service"');
		expect(outcome.descriptor.content).toContain('ExecStart="/opt/Armada Vehicle/papyrus" "serve" "a value"');
		expect(outcome.descriptor.content).toContain("Restart=on-failure");
		expect(outcome.descriptor.content).toContain("StartLimitIntervalSec=60");
		expect(outcome.descriptor.content).toContain("StartLimitBurst=4");
		expect(outcome.descriptor.content).toContain("MemoryHigh=201326592");
		expect(outcome.descriptor.content).toContain("MemoryMax=268435456");
		expect(outcome.descriptor.content).toContain("CPUQuota=75%");
		expect(outcome.descriptor.content).toContain("TasksMax=32");
		expect(outcome.descriptor.content).toContain("NoNewPrivileges=true");
		expect(outcome.descriptor.content).toContain("PrivateTmp=true");
		expect(outcome.descriptor.content).toContain("After=network-online.target");
		expect(outcome.descriptor.content).toContain("Wants=network-online.target");
		expect(outcome.diagnostics).toEqual([]);
	});

	it("omits memory boundaries when the manifest does not request them", () => {
		const outcome = systemdStrategy.generateDescriptor(vehicle());
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.descriptor.content).not.toContain("MemoryHigh=");
		expect(outcome.descriptor.content).not.toContain("MemoryMax=");
	});

	it("generates a finite adaptive-daemon memory envelope", () => {
		const outcome = systemdStrategy.generateDescriptor(
			vehicle({
				name: "indexer",
				resources: {
					memoryHighBytes: { value: 2_147_483_648, enforcement: "required" },
					maximumMemoryBytes: { value: 3_221_225_472, enforcement: "required" },
				},
			}),
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.descriptor.content).toContain("MemoryHigh=2147483648");
		expect(outcome.descriptor.content).toContain("MemoryMax=3221225472");
	});

	it("maps a Burstable percentage envelope to systemd", () => {
		const outcome = systemdStrategy.generateDescriptor(
			vehicle({
				name: "lector",
				resources: {
					memoryLowPercent: { value: 3, enforcement: "required" },
					memoryHighPercent: { value: 30, enforcement: "required" },
					maximumMemoryPercent: { value: 37.5, enforcement: "required" },
					cpuWeight: { value: 100, enforcement: "required" },
				},
			}),
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.descriptor.content).toContain("MemoryLow=3%");
		expect(outcome.descriptor.content).toContain("MemoryHigh=30%");
		expect(outcome.descriptor.content).toContain("MemoryMax=37.5%");
		expect(outcome.descriptor.content).toContain("CPUWeight=100");
		expect(outcome.descriptor.content).not.toContain("CPUQuota=");
	});

	it("reports percentage envelopes unsupported by launchd", () => {
		const resources = {
			memoryLowPercent: { value: 3, enforcement: "required" as const },
			memoryHighPercent: { value: 30, enforcement: "required" as const },
			maximumMemoryPercent: { value: 37.5, enforcement: "required" as const },
		};
		const outcome = launchdStrategy.generateDescriptor(vehicle({ restart: { policy: "never" }, resources }));
		expect(outcome).toMatchObject({
			ok: false,
			diagnostics: [
				{ code: "NATIVE_RESOURCE_UNSUPPORTED_REQUIRED", path: "/resources/memoryLowPercent" },
				{ code: "NATIVE_RESOURCE_UNSUPPORTED_REQUIRED", path: "/resources/memoryHighPercent" },
				{ code: "NATIVE_RESOURCE_UNSUPPORTED_REQUIRED", path: "/resources/maximumMemoryPercent" },
			],
		});
	});

	it("rejects descriptor control-character injection", () => {
		const outcome = systemdStrategy.generateDescriptor(vehicle({ arguments: ["serve\n[Install]"] }));
		expect(outcome).toMatchObject({ ok: false, diagnostics: [{ code: "NATIVE_DESCRIPTOR_TEXT_INVALID", severity: "error" }] });
	});

	it("rejects control characters injected through an env value", () => {
		const outcome = systemdStrategy.generateDescriptor(vehicle({ env: { PI_BIN: "/bin/pi\n[Install]" } }));
		expect(outcome).toMatchObject({ ok: false, diagnostics: [{ code: "NATIVE_DESCRIPTOR_TEXT_INVALID", severity: "error" }] });
	});

	it("emits a vehicle's own env entries alongside the launch-provenance line in a systemd unit", () => {
		const outcome = systemdStrategy.generateDescriptor(
			vehicle({ restart: { policy: "never" }, env: { PI_BIN: "/abs/path/pi", PATH: "/abs/bin:/usr/bin" } }),
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.descriptor.content).toContain('Environment="VEHICLE_LAUNCH_PROVENANCE=service"');
		expect(outcome.descriptor.content).toContain('Environment="PATH=/abs/bin:/usr/bin"');
		expect(outcome.descriptor.content).toContain('Environment="PI_BIN=/abs/path/pi"');
	});

	it("emits a vehicle's own env entries in a launchd EnvironmentVariables dict", () => {
		const outcome = launchdStrategy.generateDescriptor(vehicle({ restart: { policy: "never" }, env: { PI_BIN: "/abs/path/pi" } }));
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.descriptor.content).toContain("<key>VEHICLE_LAUNCH_PROVENANCE</key>");
		expect(outcome.descriptor.content).toContain("<key>PI_BIN</key>");
		expect(outcome.descriptor.content).toContain("<string>/abs/path/pi</string>");
	});

	it("emits a vehicle's own env entries as set commands ahead of a Task Scheduler command line", () => {
		const outcome = windowsTaskSchedulerStrategy.generateDescriptor(
			vehicle({ executable: "C:\\Program Files\\Papyrus\\papyrus.exe", env: { PI_BIN: "C:\\pi\\pi.exe" } }),
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.descriptor.content).toContain("set PI_BIN=C:\\pi\\pi.exe");
		expect(outcome.descriptor.content).toContain("set VEHICLE_LAUNCH_PROVENANCE=service");
		expect(outcome.descriptor.content.indexOf("VEHICLE_LAUNCH_PROVENANCE")).toBeLessThan(outcome.descriptor.content.indexOf("PI_BIN"));
	});

	it("fails launchd generation when bounded restart semantics are requested", () => {
		const outcome = launchdStrategy.generateDescriptor(vehicle());
		expect(outcome).toMatchObject({
			ok: false,
			diagnostics: [{ code: "NATIVE_RESTART_ATTEMPT_LIMIT_UNSUPPORTED", severity: "error" }],
		});
	});

	it("emits a launchd LaunchAgent and reports optional unsupported controls", () => {
		const outcome = launchdStrategy.generateDescriptor(
			vehicle({
				restart: { policy: "never" },
				arguments: ["serve", "a&b"],
				resources: { maximumMemoryBytes: { value: 1024, enforcement: "optional" } },
			}),
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(String(outcome.descriptor.identity)).toBe("dev.danypops.armada.papyrus");
		expect(outcome.descriptor.fileName).toBe("dev.danypops.armada.papyrus.plist");
		expect(outcome.descriptor.content).toContain("<string>a&amp;b</string>");
		expect(outcome.descriptor.content).toContain("<key>RunAtLoad</key>");
		expect(outcome.descriptor.content).toContain("<key>VEHICLE_LAUNCH_PROVENANCE</key>");
		expect(outcome.diagnostics).toMatchObject([{ code: "NATIVE_RESOURCE_UNSUPPORTED_OPTIONAL", severity: "warning" }]);
	});

	it("maps bounded on-failure restart to Task Scheduler and reports its missing window control", () => {
		const outcome = windowsTaskSchedulerStrategy.generateDescriptor(
			vehicle({ executable: "C:\\Program Files\\Papyrus\\papyrus.exe", arguments: ["serve", "a value"] }),
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(String(outcome.descriptor.identity)).toBe("\\Armada\\papyrus");
		expect(outcome.descriptor.fileName).toBe("papyrus.xml");
		expect(outcome.descriptor.content).toContain("<Command>cmd.exe</Command>");
		expect(outcome.descriptor.content).toContain("VEHICLE_LAUNCH_PROVENANCE=service");
		expect(outcome.descriptor.content).toContain("C:\\Program Files\\Papyrus\\papyrus.exe");
		expect(outcome.descriptor.content).toContain("<Count>3</Count>");
		expect(outcome.descriptor.content).toContain("<Interval>PT1S</Interval>");
		expect(outcome.descriptor.content).toContain("<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>");
		expect(outcome.diagnostics).toMatchObject([{ code: "NATIVE_RESTART_WINDOW_UNSUPPORTED", severity: "warning" }]);
	});

	it("reports unsupported runtime requirements according to their enforcement", () => {
		const required = launchdStrategy.generateDescriptor(
			vehicle({ restart: { policy: "never" }, runtime: { privateTemporaryDirectory: { enforcement: "required" } } }),
		);
		expect(required).toMatchObject({ ok: false, diagnostics: [{ code: "NATIVE_RUNTIME_UNSUPPORTED_REQUIRED", severity: "error" }] });

		const optional = windowsTaskSchedulerStrategy.generateDescriptor(
			vehicle({ restart: { policy: "never" }, runtime: { networkReadiness: { enforcement: "optional" } } }),
		);
		expect(optional).toMatchObject({
			ok: true,
			diagnostics: [{ code: "NATIVE_RUNTIME_UNSUPPORTED_OPTIONAL", severity: "warning" }],
		});
	});

	it("rejects unsupported required resources and restart modes", () => {
		const memoryHigh = launchdStrategy.generateDescriptor(
			vehicle({
				restart: { policy: "never" },
				resources: { memoryHighBytes: { value: 1_024, enforcement: "required" } },
			}),
		);
		expect(memoryHigh).toMatchObject({ ok: false, diagnostics: [{ code: "NATIVE_RESOURCE_UNSUPPORTED_REQUIRED" }] });

		const resource = windowsTaskSchedulerStrategy.generateDescriptor(
			vehicle({
				restart: { policy: "never" },
				resources: { maximumTasks: { value: 4, enforcement: "required" } },
			}),
		);
		expect(resource).toMatchObject({ ok: false, diagnostics: [{ code: "NATIVE_RESOURCE_UNSUPPORTED_REQUIRED" }] });

		const restart = windowsTaskSchedulerStrategy.generateDescriptor(
			vehicle({ restart: { policy: "always", delayMs: 1_000, maxAttempts: 3, windowMs: 60_000 } }),
		);
		expect(restart).toMatchObject({ ok: false, diagnostics: [{ code: "NATIVE_RESTART_MODE_UNSUPPORTED" }] });
	});
});
