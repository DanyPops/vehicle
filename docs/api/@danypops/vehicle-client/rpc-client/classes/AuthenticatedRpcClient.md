[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [rpc-client](../README.md) / AuthenticatedRpcClient

# Class: AuthenticatedRpcClient\<OperationName, Inputs, Outputs\>

Defined in: [packages/vehicle-client/src/rpc-client.ts:23](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/rpc-client.ts#L23)

## Type Parameters

### OperationName

`OperationName` *extends* `string`

union of operation name string literals

### Inputs

`Inputs` *extends* `Record`\<`OperationName`, `unknown`\>

a `Record<OperationName, unknown>` mapping each operation to its input type

### Outputs

`Outputs` *extends* `Record`\<`OperationName`, `unknown`\>

a `Record<OperationName, unknown>` mapping each operation to its output type

## Constructors

### Constructor

> **new AuthenticatedRpcClient**\<`OperationName`, `Inputs`, `Outputs`\>(`baseUrl`, `token`, `options`): `AuthenticatedRpcClient`\<`OperationName`, `Inputs`, `Outputs`\>

Defined in: [packages/vehicle-client/src/rpc-client.ts:32](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/rpc-client.ts#L32)

#### Parameters

##### baseUrl

`string`

##### token

`string`

##### options

[`AuthenticatedRpcClientOptions`](../interfaces/AuthenticatedRpcClientOptions.md)

#### Returns

`AuthenticatedRpcClient`\<`OperationName`, `Inputs`, `Outputs`\>

## Methods

### call()

> **call**\<`Name`\>(`operation`, `input`): `Promise`\<`Outputs`\[`Name`\]\>

Defined in: [packages/vehicle-client/src/rpc-client.ts:51](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/rpc-client.ts#L51)

#### Type Parameters

##### Name

`Name` *extends* `string`

#### Parameters

##### operation

`Name`

##### input

`Inputs`\[`Name`\]

#### Returns

`Promise`\<`Outputs`\[`Name`\]\>

***

### health()

> **health**(): `Promise`\<\{ `ok`: `true`; `version`: `string`; \}\>

Defined in: [packages/vehicle-client/src/rpc-client.ts:76](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/rpc-client.ts#L76)

#### Returns

`Promise`\<\{ `ok`: `true`; `version`: `string`; \}\>

***

### operations()

> **operations**(): `Promise`\<`OperationName`[]\>

Defined in: [packages/vehicle-client/src/rpc-client.ts:62](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/rpc-client.ts#L62)

#### Returns

`Promise`\<`OperationName`[]\>

***

### ready()

> **ready**(): `Promise`\<`boolean`\>

Defined in: [packages/vehicle-client/src/rpc-client.ts:69](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/rpc-client.ts#L69)

#### Returns

`Promise`\<`boolean`\>
