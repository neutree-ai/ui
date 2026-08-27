import { describe, expect, it } from "vitest";
import { writesWorkloadImage } from "@/domains/endpoint/lib/recipe-image-feature";
import type { RecipeFeature } from "@/foundation/recipe/types";

const feature = (overrides: Partial<RecipeFeature> = {}): RecipeFeature => ({
  name: "image",
  type: "input",
  engine_args: { image: "${value}" },
  ...overrides,
});

describe("writesWorkloadImage", () => {
  it("recognises a feature whose input is the whole image argument", () => {
    expect(writesWorkloadImage(feature())).toBe(true);
  });

  it("goes by what the feature writes, not by what it is called", () => {
    // `name` and `display_name` are the catalog author's to choose. Keying off
    // either would work only for catalogs that happen to name it `image`.
    expect(
      writesWorkloadImage(
        feature({ name: "workload-image", display_name: "工作负载镜像" }),
      ),
    ).toBe(true);

    expect(
      writesWorkloadImage(
        feature({ name: "image", engine_args: { command: "${value}" } }),
      ),
    ).toBe(false);
  });

  it("declines when the input is only part of the reference", () => {
    // `myprefix/${value}` means the user supplies one component, not a
    // reference. An explorer writes whole, fully-qualified references, so
    // putting one here would quietly corrupt the value.
    for (const written of [
      "myprefix/${value}",
      "${value}:latest",
      "registry.example.com/${value}",
      " ${value}",
    ]) {
      expect(
        writesWorkloadImage(feature({ engine_args: { image: written } })),
      ).toBe(false);
    }
  });

  it("declines a feature that writes no image argument at all", () => {
    expect(writesWorkloadImage(feature({ engine_args: {} }))).toBe(false);
    expect(writesWorkloadImage(feature({ engine_args: null }))).toBe(false);
    expect(writesWorkloadImage(feature({ engine_args: undefined }))).toBe(
      false,
    );
  });

  it("declines a feature that is not a free input", () => {
    // A boolean or a select does not carry a user-typed value for an explorer
    // to replace; a select's options bring their own engine_args.
    expect(writesWorkloadImage(feature({ type: "boolean" }))).toBe(false);
    expect(writesWorkloadImage(feature({ type: "select" }))).toBe(false);
    expect(writesWorkloadImage(feature({ type: undefined }))).toBe(false);
  });
});
