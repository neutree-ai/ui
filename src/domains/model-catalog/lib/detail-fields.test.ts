import { describe, expect, it } from "vitest";
import type { ModelCatalog } from "@/domains/model-catalog/types";
import { fieldKeys } from "@/foundation/testing/detail-fields";
import type { ModelSpec } from "@/foundation/types/serving-types";
import { servingProfileFields } from "./detail-fields";

const show = { engine: () => null, model: () => null, task: () => null };
const profile = (file: string) => ({
  catalog: {} as ModelCatalog,
  model: { name: "qwen", file } as ModelSpec,
});

describe("servingProfileFields", () => {
  it.each([
    { file: "model.gguf", shown: true },
    { file: "", shown: false },
  ])("lists the model file $file: $shown", ({ file, shown }) => {
    const fields = servingProfileFields(profile(file), show);

    expect(fieldKeys(fields.profile).includes("modelFile")).toBe(shown);
    expect(fieldKeys(fields.header)).not.toContain("modelFile");
  });
});
