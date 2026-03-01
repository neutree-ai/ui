import type { CrudFilter } from "@refinedev/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateFilter } from "./generate-filter";

type MockQuery = Record<string, ReturnType<typeof vi.fn>>;

const createMockQuery = (): MockQuery => {
  const mock: MockQuery = {};
  for (const method of [
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "contains",
    "not",
    "ilike",
    "like",
    "is",
    "or",
    "filter",
  ]) {
    mock[method] = vi.fn().mockReturnValue(mock);
  }
  return mock;
};

describe("generateFilter", () => {
  let query: MockQuery;

  beforeEach(() => {
    query = createMockQuery();
  });

  it("eq", () => {
    generateFilter({ field: "name", operator: "eq", value: "a" }, query);
    expect(query.eq).toHaveBeenCalledWith("name", "a");
  });

  it("ne", () => {
    generateFilter({ field: "name", operator: "ne", value: "a" }, query);
    expect(query.neq).toHaveBeenCalledWith("name", "a");
  });

  it("in", () => {
    generateFilter(
      { field: "status", operator: "in", value: ["a", "b"] },
      query,
    );
    expect(query.in).toHaveBeenCalledWith("status", ["a", "b"]);
  });

  it("ina — array contains", () => {
    generateFilter(
      { field: "tags", operator: "ina", value: ["x", "y"] },
      query,
    );
    expect(query.contains).toHaveBeenCalledWith("tags", ["x", "y"]);
  });

  it("nina — not array contains", () => {
    generateFilter(
      { field: "tags", operator: "nina", value: ["x", "y"] },
      query,
    );
    expect(query.not).toHaveBeenCalledWith("tags", "cs", '{"x","y"}');
  });

  it.each(["gt", "gte", "lt", "lte"] as const)("%s", (op) => {
    generateFilter({ field: "count", operator: op, value: 5 }, query);
    expect(query[op]).toHaveBeenCalledWith("count", 5);
  });

  it("between — applies gte + lte", () => {
    generateFilter(
      { field: "age", operator: "between", value: [10, 20] },
      query,
    );
    expect(query.gte).toHaveBeenCalledWith("age", 10);
    expect(query.lte).toHaveBeenCalledWith("age", 20);
  });

  it("between — throws on wrong length", () => {
    expect(() =>
      generateFilter({ field: "age", operator: "between", value: [1] }, query),
    ).toThrow("expects a range between 2 values");
  });

  it("contains — wraps with %", () => {
    generateFilter(
      { field: "name", operator: "contains", value: "foo" },
      query,
    );
    expect(query.ilike).toHaveBeenCalledWith("name", "%foo%");
  });

  it("containss — case-sensitive like", () => {
    generateFilter(
      { field: "name", operator: "containss", value: "Foo" },
      query,
    );
    expect(query.like).toHaveBeenCalledWith("name", "%Foo%");
  });

  it("null", () => {
    generateFilter({ field: "deleted", operator: "null", value: true }, query);
    expect(query.is).toHaveBeenCalledWith("deleted", null);
  });

  it("startswith", () => {
    generateFilter(
      { field: "name", operator: "startswith", value: "pre" },
      query,
    );
    expect(query.ilike).toHaveBeenCalledWith("name", "pre%");
  });

  it("endswith", () => {
    generateFilter(
      { field: "name", operator: "endswith", value: "suf" },
      query,
    );
    expect(query.ilike).toHaveBeenCalledWith("name", "%suf");
  });

  it("or — composes sub-filters", () => {
    generateFilter(
      {
        operator: "or",
        value: [
          { field: "name", operator: "eq", value: "a" },
          { field: "name", operator: "contains", value: "b" },
        ],
      } as CrudFilter,
      query,
    );
    expect(query.or).toHaveBeenCalledWith("name.eq.a,name.ilike.%b%");
  });

  it("or — handles null operator in sub-filter", () => {
    generateFilter(
      {
        operator: "or",
        value: [{ field: "deleted", operator: "null", value: null }],
      } as CrudFilter,
      query,
    );
    expect(query.or).toHaveBeenCalledWith("deleted.is.null");
  });

  it("or — skips nested or/and sub-filters", () => {
    generateFilter(
      {
        operator: "or",
        value: [
          { field: "name", operator: "eq", value: "a" },
          { operator: "or", value: [] },
        ],
      } as CrudFilter,
      query,
    );
    // nested "or" sub-item returns undefined, producing trailing comma
    // this is a known limitation of the current implementation
    expect(query.or).toHaveBeenCalledWith("name.eq.a,");
  });

  it("and — throws", () => {
    expect(() =>
      generateFilter({ operator: "and", value: [] } as CrudFilter, query),
    ).toThrow("not supported");
  });

  it("falls through to query.filter for unknown ops", () => {
    generateFilter(
      { field: "data", operator: "ncontains", value: "x" } as CrudFilter,
      query,
    );
    expect(query.filter).toHaveBeenCalledWith("data", "not.ilike", "x");
  });
});
