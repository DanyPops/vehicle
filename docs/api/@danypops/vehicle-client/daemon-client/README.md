[**Documentation**](../../../README.md)

***

[Documentation](../../../README.md) / [@danypops/vehicle-client](../README.md) / daemon-client

# daemon-client

## Classes

- [MutationOutcomeUnknownError](classes/MutationOutcomeUnknownError.md)
- [PreDispatchConnectionError](classes/PreDispatchConnectionError.md)

## Interfaces

- [CallOnceOptions](interfaces/CallOnceOptions.md)
- [CircuitBreakerOptions](interfaces/CircuitBreakerOptions.md)
- [CircuitBreakerState](interfaces/CircuitBreakerState.md)
- [ConnectPolicyOptions](interfaces/ConnectPolicyOptions.md)
- [ConnectVersionCheckRetryOptions](interfaces/ConnectVersionCheckRetryOptions.md)
- [CreateRetryingClientOptions](interfaces/CreateRetryingClientOptions.md)
- [DaemonHandleLike](interfaces/DaemonHandleLike.md)
- [DaemonIdentityChange](interfaces/DaemonIdentityChange.md)
- [DaemonStatus](interfaces/DaemonStatus.md)
- [DaemonStatusOptions](interfaces/DaemonStatusOptions.md)
- [PushChannelClient](interfaces/PushChannelClient.md)
- [PushChannelClientOptions](interfaces/PushChannelClientOptions.md)
- [RetryingClient](interfaces/RetryingClient.md)
- [SpawnDetachedDaemonOptions](interfaces/SpawnDetachedDaemonOptions.md)
- [SpawnPlatformOptions](interfaces/SpawnPlatformOptions.md)
- [VersionCheckOptions](interfaces/VersionCheckOptions.md)

## Type Aliases

- [DaemonInstanceIdentity](type-aliases/DaemonInstanceIdentity.md)
- [DaemonStatusState](type-aliases/DaemonStatusState.md)
- [ExpectedVersion](type-aliases/ExpectedVersion.md)
- [PushChannelState](type-aliases/PushChannelState.md)
- [StaleConnectionPredicate](type-aliases/StaleConnectionPredicate.md)

## Functions

- [compareVersions](functions/compareVersions.md)
- [connectPushChannel](functions/connectPushChannel.md)
- [connectWithPolicy](functions/connectWithPolicy.md)
- [connectWithVersionCheck](functions/connectWithVersionCheck.md)
- [createReconnectingVehicleClient](functions/createReconnectingVehicleClient.md)
- [createRetryingClient](functions/createRetryingClient.md)
- [daemonInstanceIdentity](functions/daemonInstanceIdentity.md)
- [daemonStatus](functions/daemonStatus.md)
- [isDefinitelyPreDispatchConnectionError](functions/isDefinitelyPreDispatchConnectionError.md)
- [isLikelyStaleConnectionError](functions/isLikelyStaleConnectionError.md)
- [spawnDetachedDaemon](functions/spawnDetachedDaemon.md)
