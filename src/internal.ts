export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function roundScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function normalizeCodes(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()))]
    .filter((value) => value.length > 0)
    .sort(compareCodeUnits);
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

export function clone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => clone(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      copy[key] = clone(child);
    }
    return copy as T;
  }
  return value;
}

export function assertFiniteNumber(
  value: number,
  name: string,
  minimum = 0,
): void {
  if (!Number.isFinite(value) || value < minimum) {
    throw new RangeError(`${name} must be a finite number >= ${minimum}`);
  }
}

export function stableFingerprint(value: unknown): string {
  const input = JSON.stringify(sortObject(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareCodeUnits(left, right))
        .map(([key, child]) => [key, sortObject(child)]),
    );
  }
  return value;
}
