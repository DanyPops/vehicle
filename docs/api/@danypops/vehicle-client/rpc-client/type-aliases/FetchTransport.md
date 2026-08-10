[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client](../../README.md) / [rpc-client](../README.md) / FetchTransport

# Type Alias: FetchTransport

> **FetchTransport** = (`request`) => `Promise`\<`Response`\>

Defined in: [packages/vehicle-client/src/rpc-client.ts:9](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client/src/rpc-client.ts#L9)

Typed authenticated loopback RPC client. Generalizes what was
byte-identical between web-spider-daemon's and jittor's client.ts
(same header comment admitting the duplication): POST {op, input} JSON
to a single dispatch endpoint with a Bearer token, plus /health and
/ready.

## Parameters

### request

`Request`

## Returns

`Promise`\<`Response`\>
