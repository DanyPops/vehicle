[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [multi-select-list](../README.md) / MultiSelectList

# Class: MultiSelectList\<T\>

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:72

A bounded checkbox list whose viewport follows keyboard focus.

## Type Parameters

### T

`T`

## Implements

- `Component`

## Constructors

### Constructor

> **new MultiSelectList**\<`T`\>(`options`): `MultiSelectList`\<`T`\>

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:88

#### Parameters

##### options

[`MultiSelectListOptions`](../interfaces/MultiSelectListOptions.md)\<`T`\>

#### Returns

`MultiSelectList`\<`T`\>

## Properties

### model

> `readonly` **model**: `MultiSelectListModel`\<`T`\>

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:73

## Accessors

### checkedValues

#### Get Signature

> **get** **checkedValues**(): `T`[]

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:89

##### Returns

`T`[]

## Methods

### focus()

> **focus**(`index`): `void`

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:90

#### Parameters

##### index

`number`

#### Returns

`void`

***

### handleInput()

> **handleInput**(`data`): `void`

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:94

Optional handler for keyboard input when the component has focus.

#### Parameters

##### data

`string`

#### Returns

`void`

#### Implementation of

`Component.handleInput`

***

### invalidate()

> **invalidate**(): `void`

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:93

Clears any cached render state. Called by the host on theme changes.

#### Returns

`void`

#### Implementation of

`Component.invalidate`

***

### render()

> **render**(`width`): `string`[]

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:95

Render the component to lines for the given viewport width. Each returned line must not exceed `width`.

#### Parameters

##### width

`number`

#### Returns

`string`[]

#### Implementation of

`Component.render`

***

### setChecked()

> **setChecked**(`index`, `checked`): `void`

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:92

#### Parameters

##### index

`number`

##### checked

`boolean`

#### Returns

`void`

***

### setMaxVisibleRows()

> **setMaxVisibleRows**(`rows`): `void`

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:91

#### Parameters

##### rows

`number`

#### Returns

`void`
