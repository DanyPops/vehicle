[**Documentation**](../../../README.md)

***

[Documentation](../../../README.md) / [@danypops/vehicle-core](../README.md) / index

# index

## Classes

- [VehicleError](classes/VehicleError.md)
- [VehicleJobSteerChannel](classes/VehicleJobSteerChannel.md)
- [VehicleJobWakeLog](classes/VehicleJobWakeLog.md)

## Interfaces

- [AtomicJsonFsAdapter](interfaces/AtomicJsonFsAdapter.md)
- [AtomicJsonWriteOptions](interfaces/AtomicJsonWriteOptions.md)
- [AtomicJsonWriter](interfaces/AtomicJsonWriter.md)
- [AtomicJsonWriterOptions](interfaces/AtomicJsonWriterOptions.md)
- [DefineErrorMappingOptions](interfaces/DefineErrorMappingOptions.md)
- [DefineVehicleEventOptions](interfaces/DefineVehicleEventOptions.md)
- [DefineVehicleOperationOptions](interfaces/DefineVehicleOperationOptions.md)
- [LooseObjectProperty](interfaces/LooseObjectProperty.md)
- [VehicleApprovalAuthority](interfaces/VehicleApprovalAuthority.md)
- [VehicleApprovalOutcome](interfaces/VehicleApprovalOutcome.md)
- [VehicleApprovalRequest](interfaces/VehicleApprovalRequest.md)
- [VehicleBackgroundCapability](interfaces/VehicleBackgroundCapability.md)
- [VehicleClient](interfaces/VehicleClient.md)
- [VehicleContentBlock](interfaces/VehicleContentBlock.md)
- [VehicleErrorClassMapping](interfaces/VehicleErrorClassMapping.md)
- [VehicleErrorOptions](interfaces/VehicleErrorOptions.md)
- [VehicleErrorPredicateMapping](interfaces/VehicleErrorPredicateMapping.md)
- [VehicleEvent](interfaces/VehicleEvent.md)
- [VehicleEventDescriptor](interfaces/VehicleEventDescriptor.md)
- [VehicleFailure](interfaces/VehicleFailure.md)
- [VehicleFailureDescriptor](interfaces/VehicleFailureDescriptor.md)
- [VehicleInvocationOptions](interfaces/VehicleInvocationOptions.md)
- [VehicleJobEvictionCandidate](interfaces/VehicleJobEvictionCandidate.md)
- [VehicleJobRetentionOptions](interfaces/VehicleJobRetentionOptions.md)
- [VehicleJobSteerPushResult](interfaces/VehicleJobSteerPushResult.md)
- [VehicleJobWakeAppendResult](interfaces/VehicleJobWakeAppendResult.md)
- [VehicleJobWakeBudget](interfaces/VehicleJobWakeBudget.md)
- [VehicleJobWakeEntry](interfaces/VehicleJobWakeEntry.md)
- [VehicleJobWakeLogOptions](interfaces/VehicleJobWakeLogOptions.md)
- [VehicleJobWakeLogReader](interfaces/VehicleJobWakeLogReader.md)
- [VehicleLimits](interfaces/VehicleLimits.md)
- [VehicleManifest](interfaces/VehicleManifest.md)
- [VehicleManifestIdentity](interfaces/VehicleManifestIdentity.md)
- [VehicleManifestOperation](interfaces/VehicleManifestOperation.md)
- [VehicleOperation](interfaces/VehicleOperation.md)
- [VehicleOperationBinding](interfaces/VehicleOperationBinding.md)
- [VehicleOperationContext](interfaces/VehicleOperationContext.md)
- [VehicleOperationDescriptor](interfaces/VehicleOperationDescriptor.md)
- [VehiclePrincipal](interfaces/VehiclePrincipal.md)
- [VehicleRecovery](interfaces/VehicleRecovery.md)
- [VehicleSchemaCodec](interfaces/VehicleSchemaCodec.md)
- [VehicleSchemaIssue](interfaces/VehicleSchemaIssue.md)
- [VehicleSubscription](interfaces/VehicleSubscription.md)
- [WithVehicleContent](interfaces/WithVehicleContent.md)

## Type Aliases

- [JsonPrimitive](type-aliases/JsonPrimitive.md)
- [JsonSchema](type-aliases/JsonSchema.md)
- [JsonValue](type-aliases/JsonValue.md)
- [VehicleApprovalDecision](type-aliases/VehicleApprovalDecision.md)
- [VehicleCoreErrorCode](type-aliases/VehicleCoreErrorCode.md)
- [VehicleEffect](type-aliases/VehicleEffect.md)
- [VehicleErrorClass](type-aliases/VehicleErrorClass.md)
- [VehicleErrorMapping](type-aliases/VehicleErrorMapping.md)
- [VehicleEventHandler](type-aliases/VehicleEventHandler.md)
- [VehicleFailureCategory](type-aliases/VehicleFailureCategory.md)
- [VehicleIdempotency](type-aliases/VehicleIdempotency.md)
- [VehicleJobNotifyMode](type-aliases/VehicleJobNotifyMode.md)
- [VehicleJobStatus](type-aliases/VehicleJobStatus.md)
- [VehicleJobTerminationReason](type-aliases/VehicleJobTerminationReason.md)
- [VehicleJobWakeDropReason](type-aliases/VehicleJobWakeDropReason.md)
- [VehicleManifestEvent](type-aliases/VehicleManifestEvent.md)
- [VehicleOperationHandler](type-aliases/VehicleOperationHandler.md)
- [VehicleSchemaPresentation](type-aliases/VehicleSchemaPresentation.md)
- [VehicleSchemaResult](type-aliases/VehicleSchemaResult.md)

## Variables

- [DEFAULT\_APPROVAL\_EFFECTS](variables/DEFAULT_APPROVAL_EFFECTS.md)
- [DEFAULT\_APPROVAL\_TIMEOUT\_MS](variables/DEFAULT_APPROVAL_TIMEOUT_MS.md)
- [passthroughVehicleSchema](variables/passthroughVehicleSchema.md)
- [VEHICLE\_APPROVAL\_RESOLVE\_OPERATION\_NAME](variables/VEHICLE_APPROVAL_RESOLVE_OPERATION_NAME.md)
- [VEHICLE\_CREDENTIAL\_FIELD\_NAMES](variables/VEHICLE_CREDENTIAL_FIELD_NAMES.md)
- [VEHICLE\_JOB\_TERMINATION\_PRECEDENCE](variables/VEHICLE_JOB_TERMINATION_PRECEDENCE.md)
- [VEHICLE\_SCHEMA\_PRESENTATION\_EXTENSION](variables/VEHICLE_SCHEMA_PRESENTATION_EXTENSION.md)
- [vehicleApprovalRequestedEvent](variables/vehicleApprovalRequestedEvent.md)
- [vehicleApprovalResolvedEvent](variables/vehicleApprovalResolvedEvent.md)

## Functions

- [bindVehicleOperation](functions/bindVehicleOperation.md)
- [boundedCauseMessage](functions/boundedCauseMessage.md)
- [boundedValidationDetails](functions/boundedValidationDetails.md)
- [createAtomicJsonWriter](functions/createAtomicJsonWriter.md)
- [createStaticVehicleJobWakeLog](functions/createStaticVehicleJobWakeLog.md)
- [defineErrorMapping](functions/defineErrorMapping.md)
- [defineLooseObjectSchema](functions/defineLooseObjectSchema.md)
- [defineVehicleEvent](functions/defineVehicleEvent.md)
- [defineVehicleOperation](functions/defineVehicleOperation.md)
- [defineVehicleSchema](functions/defineVehicleSchema.md)
- [extractVehicleContent](functions/extractVehicleContent.md)
- [isVehicleCredentialFieldName](functions/isVehicleCredentialFieldName.md)
- [isVehicleError](functions/isVehicleError.md)
- [resolveVehicleJobTerminationReason](functions/resolveVehicleJobTerminationReason.md)
- [selectVehicleJobsForEviction](functions/selectVehicleJobsForEviction.md)
- [vehicleEventTopic](functions/vehicleEventTopic.md)
- [vehicleJobIdentityMatches](functions/vehicleJobIdentityMatches.md)

## References

### DEFAULT\_MAX\_SCHEDULES\_PER\_OWNER

Re-exports [DEFAULT_MAX_SCHEDULES_PER_OWNER](../vehicle-scheduler/variables/DEFAULT_MAX_SCHEDULES_PER_OWNER.md)

***

### DEFAULT\_MAX\_WATCHES\_PER\_SCOPE

Re-exports [DEFAULT_MAX_WATCHES_PER_SCOPE](../vehicle-watchers/variables/DEFAULT_MAX_WATCHES_PER_SCOPE.md)

***

### initialFireAt

Re-exports [initialFireAt](../vehicle-scheduler/functions/initialFireAt.md)

***

### nextFireAtAfterFire

Re-exports [nextFireAtAfterFire](../vehicle-scheduler/functions/nextFireAtAfterFire.md)

***

### nextFireAtAfterRestore

Re-exports [nextFireAtAfterRestore](../vehicle-scheduler/functions/nextFireAtAfterRestore.md)

***

### VehicleScheduleAction

Re-exports [VehicleScheduleAction](../vehicle-scheduler/type-aliases/VehicleScheduleAction.md)

***

### VehicleScheduledEntry

Re-exports [VehicleScheduledEntry](../vehicle-scheduler/interfaces/VehicleScheduledEntry.md)

***

### VehicleScheduleLimitExceeded

Re-exports [VehicleScheduleLimitExceeded](../vehicle-scheduler/classes/VehicleScheduleLimitExceeded.md)

***

### VehicleScheduleTrigger

Re-exports [VehicleScheduleTrigger](../vehicle-scheduler/type-aliases/VehicleScheduleTrigger.md)

***

### vehicleWatchTopic

Re-exports [vehicleWatchTopic](../vehicle-watchers/functions/vehicleWatchTopic.md)

***

### WatchIdConflict

Re-exports [WatchIdConflict](../vehicle-watchers/classes/WatchIdConflict.md)

***

### WatchLimitExceeded

Re-exports [WatchLimitExceeded](../vehicle-watchers/classes/WatchLimitExceeded.md)

***

### WatchRegistration

Re-exports [WatchRegistration](../vehicle-watchers/interfaces/WatchRegistration.md)

***

### WatchRegistry

Re-exports [WatchRegistry](../vehicle-watchers/classes/WatchRegistry.md)

***

### WatchRegistryOptions

Re-exports [WatchRegistryOptions](../vehicle-watchers/interfaces/WatchRegistryOptions.md)
