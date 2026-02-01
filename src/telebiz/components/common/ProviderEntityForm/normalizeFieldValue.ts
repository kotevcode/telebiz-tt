import type { FormField } from './forms';

type Primitive = string | number;

function toPrimitiveValue(value: unknown): Primitive | undefined {
  if (!value) return undefined;
  if (typeof value === 'object') {
    const candidate = (value as { value?: unknown; id?: unknown; key?: unknown; name?: unknown; label?: unknown })
      .value ?? (value as { id?: unknown }).id ?? (value as { key?: unknown }).key ??
      (value as { name?: unknown }).name ?? (value as { label?: unknown }).label;
    if (!candidate) return undefined;
    return candidate as Primitive;
  }
  return value as Primitive;
}

export function normalizeFieldValue(field: FormField, value: unknown): string | string[] | undefined {
  if (!value) return undefined;

  if (field.type === 'multiselect') {
    if (Array.isArray(value)) {
      return value
        .map(toPrimitiveValue)
        .filter((item): item is Primitive => Boolean(item))
        .map(String);
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    const primitive = toPrimitiveValue(value);
    return primitive === undefined ? [] : [String(primitive)];
  }

  if (field.type === 'select') {
    const primitive = Array.isArray(value) ? toPrimitiveValue(value[0]) : toPrimitiveValue(value);
    return primitive === undefined ? '' : String(primitive);
  }

  return value as string | string[];
}
