import { describe, expect, it } from "vitest";
import {
  computeMaxAvailable,
  deepMerge,
  validateCurrentUsage,
} from "./endpoint-form-helpers";

describe("validateCurrentUsage", () => {
  it("returns currentUsage when within capacity", () => {
    expect(validateCurrentUsage(4, 8)).toBe(4);
  });

  it("returns 0 when currentUsage exceeds capacity", () => {
    expect(validateCurrentUsage(10, 8)).toBe(0);
  });

  it("returns currentUsage when equal to capacity", () => {
    expect(validateCurrentUsage(8, 8)).toBe(8);
  });

  it("returns 0 when currentUsage is 0", () => {
    expect(validateCurrentUsage(0, 8)).toBe(0);
  });
});

describe("deepMerge", () => {
  it("overwrites shallow keys", () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it("adds new keys from source", () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("recursively merges nested objects", () => {
    const target = { nested: { a: 1, b: 2 } };
    const source = { nested: { b: 3, c: 4 } };
    expect(deepMerge(target, source)).toEqual({
      nested: { a: 1, b: 3, c: 4 },
    });
  });

  it("skips null values from source", () => {
    expect(deepMerge({ a: 1 }, { a: null } as Record<string, unknown>)).toEqual(
      { a: 1 },
    );
  });

  it("skips undefined values from source", () => {
    expect(
      deepMerge({ a: 1 }, { a: undefined } as Record<string, unknown>),
    ).toEqual({ a: 1 });
  });

  it("returns target when source is null", () => {
    const target = { a: 1 };
    expect(
      deepMerge(target, null as unknown as Record<string, unknown>),
    ).toEqual({ a: 1 });
  });

  it("returns source when target is null", () => {
    const source = { a: 1 };
    expect(
      deepMerge(null as unknown as Record<string, unknown>, source),
    ).toEqual({ a: 1 });
  });

  it("replaces arrays instead of merging", () => {
    expect(deepMerge({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] });
  });
});

describe("computeMaxAvailable", () => {
  it("uses single-node max when singleNodeMax is provided", () => {
    const singleNodeMax = {
      cpu: { available: 10, total: 16 },
      memory: { available: 20, total: 32 },
      gpu: { available: 2, total: 4 },
    };
    const result = computeMaxAvailable(singleNodeMax, null, {
      cpu: 2,
      memory: 4,
      gpu: 1,
    });
    // available = singleNodeMax.available + validCurrentUsage
    expect(result.cpu).toEqual({ available: 12, total: 16 });
    expect(result.memory).toEqual({ available: 24, total: 32 });
    expect(result.gpu).toEqual({ available: 3, total: 4 });
  });

  it("falls back to cluster resources when singleNodeMax is null", () => {
    const clusterResources = {
      cpu: { available: 80, total: 100 },
      memory: { available: 200, total: 256 },
    };
    const result = computeMaxAvailable(null, clusterResources, {
      cpu: 4,
      memory: 8,
      gpu: 0,
    });
    expect(result.cpu).toEqual({ available: 84, total: 100 });
    expect(result.memory).toEqual({ available: 208, total: 256 });
    expect(result.gpu).toEqual({ available: 0, total: 0 });
  });

  it("returns all zeros when both sources are null", () => {
    const result = computeMaxAvailable(null, null, {
      cpu: 0,
      memory: 0,
      gpu: 0,
    });
    expect(result).toEqual({
      cpu: { available: 0, total: 0 },
      memory: { available: 0, total: 0 },
      gpu: { available: 0, total: 0 },
    });
  });

  it("resets currentUsage that exceeds capacity", () => {
    const singleNodeMax = {
      cpu: { available: 10, total: 16 },
      memory: { available: 20, total: 32 },
      gpu: { available: 2, total: 4 },
    };
    // currentUsage exceeds total → validateCurrentUsage returns 0
    const result = computeMaxAvailable(singleNodeMax, null, {
      cpu: 20,
      memory: 40,
      gpu: 10,
    });
    expect(result.cpu).toEqual({ available: 10, total: 16 });
    expect(result.memory).toEqual({ available: 20, total: 32 });
    expect(result.gpu).toEqual({ available: 2, total: 4 });
  });
});
