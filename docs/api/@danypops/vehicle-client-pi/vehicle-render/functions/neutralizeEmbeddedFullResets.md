[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [vehicle-render](../README.md) / neutralizeEmbeddedFullResets

# Function: neutralizeEmbeddedFullResets()

> **neutralizeEmbeddedFullResets**(`text`): `string`

Defined in: [packages/vehicle-client-pi/src/vehicle-render.ts:61](https://github.com/DanyPops/vehicle/blob/aaa01ef790022c6466d83012d0b7f53d90e6e6d3/packages/vehicle-client-pi/src/vehicle-render.ts#L61)

pi-tui's own truncateToWidth (dist/utils.js, finalizeTruncatedResult) embeds an
unconditional full SGR reset (\x1b[0m) after any truncated content -- even for
plain, uncolored text -- whenever it actually truncates. That's fine in isolation,
but this string is later handed to Pi's own Box, which paints one background color
across the *entire* line by wrapping it once, start to end (Box.applyBg /
applyBackgroundToLine in the same package). A full reset embedded mid-line kills
that background early: everything after it renders on the terminal's own default
background instead of the tool box's, since nothing re-establishes it afterward.

Replacing \x1b[0m with every SGR reset *except* background (\x1b[49m) preserves
truncateToWidth's own intent -- stop whatever styling the truncated/ellipsis text
carried -- without discarding a background this function has no visibility into
and that gets applied by a caller further up the render tree.

## Parameters

### text

`string`

## Returns

`string`
