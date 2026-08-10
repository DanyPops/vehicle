[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [secrets-tui](../README.md) / RunSecretsCommandOptions

# Interface: RunSecretsCommandOptions

Defined in: [packages/vehicle-client-pi/src/secrets-tui.ts:370](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-tui.ts#L370)

## Properties

### backends

> **backends**: [`SecretsBackend`](../../secrets-backend/interfaces/SecretsBackend.md)[]

Defined in: [packages/vehicle-client-pi/src/secrets-tui.ts:371](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-tui.ts#L371)

***

### extraActions?

> `optional` **extraActions?**: [`SecretsMenuAction`](SecretsMenuAction.md)[]

Defined in: [packages/vehicle-client-pi/src/secrets-tui.ts:375](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-tui.ts#L375)

Appended to the [secrets] menu below every real secret record.

***

### pick?

> `optional` **pick?**: [`PickFromList`](../type-aliases/PickFromList.md)

Defined in: [packages/vehicle-client-pi/src/secrets-tui.ts:376](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-tui.ts#L376)

***

### servicesRegistry?

> `optional` **servicesRegistry?**: [`ServicesRegistry`](../../secrets-backend/interfaces/ServicesRegistry.md)

Defined in: [packages/vehicle-client-pi/src/secrets-tui.ts:373](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/secrets-tui.ts#L373)

Omit to skip the [services] menu entirely -- a consumer with nothing service-registry-shaped still gets a working [secrets] view.
