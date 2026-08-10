[**Documentation**](../../../../README.md)

***

[Documentation](../../../../README.md) / [@danypops/vehicle-client-pi](../../README.md) / [multi-select-list](../README.md) / MultiSelectListOptions

# Interface: MultiSelectListOptions\<T\>

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:57

## Type Parameters

### T

`T`

## Properties

### glyphs?

> `readonly` `optional` **glyphs?**: `GlyphTheme`

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:62

***

### items

> `readonly` **items**: readonly [`MultiSelectListItem`](MultiSelectListItem.md)\<`T`\>[]

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:58

***

### matchesKey?

> `readonly` `optional` **matchesKey?**: `KeyMatcher`

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:63

***

### maxVisibleRows?

> `readonly` `optional` **maxVisibleRows?**: `number`

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:60

***

### measure?

> `readonly` `optional` **measure?**: `TextMeasure`

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:61

***

### onActivate?

> `readonly` `optional` **onActivate?**: (`item`) => `void`

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:67

#### Parameters

##### item

[`MultiSelectListItem`](MultiSelectListItem.md)\<`T`\>

#### Returns

`void`

***

### onCancel?

> `readonly` `optional` **onCancel?**: () => `void`

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:69

#### Returns

`void`

***

### onSubmit?

> `readonly` `optional` **onSubmit?**: (`values`) => `void`

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:68

#### Parameters

##### values

`T`[]

#### Returns

`void`

***

### onToggle?

> `readonly` `optional` **onToggle?**: (`item`, `checked`) => `void`

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:66

#### Parameters

##### item

[`MultiSelectListItem`](MultiSelectListItem.md)\<`T`\>

##### checked

`boolean`

#### Returns

`void`

***

### showNumbers?

> `readonly` `optional` **showNumbers?**: `boolean`

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:65

***

### theme

> `readonly` **theme**: [`MultiSelectListTheme`](MultiSelectListTheme.md)

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:59

***

### wrapNavigation?

> `readonly` `optional` **wrapNavigation?**: `boolean`

Defined in: node\_modules/.bun/malevich-tui-components@0.25.0/node\_modules/malevich-tui-components/dist/components/multi-select-list.d.ts:64
