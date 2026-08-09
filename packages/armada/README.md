# Armada

Armada reconciles a user-scoped fleet of local Vehicle daemons through systemd user units, macOS LaunchAgents, or Windows Task Scheduler. Native service managers own the processes; Armada is not a resident supervisor.

## Install

Requires Node.js 22.

```bash
npm install --global @danypops/armada
```

## Manifest

The default manifest is `~/.config/armada/armada.json` on Linux, `~/Library/Application Support/armada/armada.json` on macOS, and `%APPDATA%\Armada\armada.json` on Windows.

```json
{
  "schemaVersion": 1,
  "vehicles": [
    {
      "name": "example",
      "version": "1.0.0",
      "executable": "/absolute/path/to/example",
      "arguments": ["serve"],
      "handlePath": "/absolute/path/to/handle.json",
      "restart": {
        "policy": "on-failure",
        "delayMs": 1000,
        "maxAttempts": 3,
        "windowMs": 60000
      },
      "readiness": {
        "timeoutMs": 5000,
        "pollIntervalMs": 100
      },
      "resources": {
        "memoryLowPercent": {
          "value": 3,
          "enforcement": "required"
        },
        "memoryHighPercent": {
          "value": 30,
          "enforcement": "required"
        },
        "maximumMemoryPercent": {
          "value": 37.5,
          "enforcement": "required"
        },
        "cpuWeight": {
          "value": 100,
          "enforcement": "required"
        }
      }
    }
  ]
}
```

Credentials and secret-like material are rejected. Executables, working directories, and handle paths must be absolute.

On systemd, `memoryHighBytes` maps to `MemoryHigh=` as the pressure boundary and `maximumMemoryBytes` maps to `MemoryMax=` as the final defense. Percentage envelopes use `memoryLowPercent`, `memoryHighPercent`, and `maximumMemoryPercent` for a protected baseline, pressure boundary, and hard ceiling relative to installed physical memory. `cpuWeight` controls relative CPU access under contention without preventing idle-capacity bursts. Byte and percentage memory boundaries cannot be mixed, and boundaries must be ordered. Percentages scale with host size; they do not track currently free memory or reserve aggregate fleet capacity. Other native managers reject required resource controls and warn for optional controls they cannot enforce.

## Commands

```bash
armada plan --json
armada reconcile --json
armada status --json
armada doctor --json
```

Integrations can atomically update one Vehicle without replacing the fleet:

```bash
armada upsert --vehicle-file ./vehicle.json --json
armada reconcile --json
```

Duplicate cleanup is consequence-planned and requires the current hash:

```bash
armada cleanup example --json
armada cleanup example --approve <planHash> --json
```

Remove an Armada-owned service and its manifest declaration with:

```bash
armada remove example --json
```

Use `--manifest <path>` with any command to select a different manifest.

## Testing integrations

`@danypops/armada/testing` provides an isolated real-registrar harness backed by a stateful mock native controller and mock Vehicle applications. Readiness can complete automatically, wait for `markReady()`, or return a timeout without touching the host service manager. `status()` projects mock application state through Armada's real fleet-status builder.

```ts
import { createArmadaTestHarness } from "@danypops/armada/testing";

const harness = await createArmadaTestHarness({ readiness: "manual" });
try {
  const registering = harness.registrar.register(vehicle);
  await harness.waitForEvent("ready-wait:example");
  harness.application("example").markReady();
  await registering;
} finally {
  await harness.dispose();
}
```

## Development

From the Vehicle repository root:

```bash
bun install
bun run check
bun test packages/armada/test
```
