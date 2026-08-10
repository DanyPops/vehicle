[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-server](../../README.md) / [logging](../README.md) / CreateLoggerOptions

# Interface: CreateLoggerOptions

Defined in: [packages/vehicle-server/src/logging.ts:46](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/logging.ts#L46)

## Properties

### additionalRedactPaths?

> `optional` **additionalRedactPaths?**: readonly `string`[]

Defined in: [packages/vehicle-server/src/logging.ts:60](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/logging.ts#L60)

Extra pino redact paths (fast-redact syntax) appended to the shared
default list -- for a domain-specific secret-shaped field (e.g.
Lector's own credential-name-matched fields) without a consumer having
to redeclare the whole default list to add one path of its own.

***

### destination?

> `optional` **destination?**: `WritableStream` \| `DestinationStream`

Defined in: [packages/vehicle-server/src/logging.ts:52](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/logging.ts#L52)

Injectable sink for tests; defaults to stderr (stdout is reserved for CLI output).

***

### env?

> `optional` **env?**: `Record`\<`string`, `string` \| `undefined`\>

Defined in: [packages/vehicle-server/src/logging.ts:53](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/logging.ts#L53)

***

### level?

> `optional` **level?**: [`LogLevel`](../type-aliases/LogLevel.md)

Defined in: [packages/vehicle-server/src/logging.ts:50](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/logging.ts#L50)

Explicit level override, takes precedence over levelEnvVar.

***

### levelEnvVar?

> `optional` **levelEnvVar?**: `string`

Defined in: [packages/vehicle-server/src/logging.ts:48](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-server/src/logging.ts#L48)

Env var read for the minimum level, e.g. "PI_PACKED_LOG_LEVEL". Defaults to "info" when unset or unrecognized.
