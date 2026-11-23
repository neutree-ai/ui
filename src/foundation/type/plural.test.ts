import { describe, expect, it } from "vitest";
import { getResourcePlural } from "./plural";

describe("getResourcePlural", () => {
  it("should convert consonant + y to ies", () => {
    expect(getResourcePlural("registry")).toBe("registries");
  });

  it("should convert vowel + y to s", () => {
    expect(getResourcePlural("boy")).toBe("boys");
  });

  it("should convert s/ss/sh/ch/x/z endings to es", () => {
    expect(getResourcePlural("box")).toBe("boxes");
  });

  it("should convert f/fe endings to ves", () => {
    expect(getResourcePlural("knife")).toBe("knives");
  });

  it("should convert consonant + o to es", () => {
    expect(getResourcePlural("hero")).toBe("heroes");
  });

  it("should convert vowel + o to s", () => {
    expect(getResourcePlural("video")).toBe("videos");
  });

  it("should add s by default", () => {
    expect(getResourcePlural("cluster")).toBe("clusters");
  });

  it("should handle empty string", () => {
    expect(getResourcePlural("")).toBe("");
  });

  it("should preserve casing", () => {
    expect(getResourcePlural("ImageRegistry")).toBe("ImageRegistries");
  });

  describe("real resource types", () => {
    it("should correctly pluralize ImageRegistry", () => {
      expect(getResourcePlural("ImageRegistry")).toBe("ImageRegistries");
    });

    it("should correctly pluralize ModelRegistry", () => {
      expect(getResourcePlural("ModelRegistry")).toBe("ModelRegistries");
    });

    it("should correctly pluralize Cluster", () => {
      expect(getResourcePlural("Cluster")).toBe("Clusters");
    });

    it("should correctly pluralize RoleAssignment", () => {
      expect(getResourcePlural("RoleAssignment")).toBe("RoleAssignments");
    });
  });
});
