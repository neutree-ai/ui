import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ModelInfoFields,
  resolveFieldValue,
} from "@/domains/model-registry/components/ModelInfoFields";
import type { ModelInfo } from "@/foundation/types/serving-types";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const textField = { key: "architecture", labelKey: "architecture" } as const;

describe("resolveFieldValue", () => {
  it("reports a value the server established", () => {
    expect(
      resolveFieldValue(
        { architecture: "Qwen2ForCausalLM" },
        { ...textField, kind: "text" },
      ),
    ).toEqual({ state: "value", text: "Qwen2ForCausalLM" });
  });

  it("groups a digit string but leaves a hand-written one alone", () => {
    expect(
      resolveFieldValue(
        { parameter_count: "494032768" },
        { key: "parameter_count", labelKey: "parameterCount", kind: "text" },
      ),
    ).toEqual({ state: "value", text: "494,032,768" });

    expect(
      resolveFieldValue(
        { parameter_count: "72.7B" },
        { key: "parameter_count", labelKey: "parameterCount", kind: "text" },
      ),
    ).toEqual({ state: "value", text: "72.7B" });
  });

  it("keeps false and zero as values rather than absences", () => {
    expect(
      resolveFieldValue(
        { is_moe: false, missing_fields: ["parameter_count"] },
        { key: "is_moe", labelKey: "isMoe", kind: "boolean" },
      ),
    ).toEqual({ state: "value", text: "false" });

    expect(
      resolveFieldValue(
        { num_experts: 0, missing_fields: [] },
        { key: "num_experts", labelKey: "numExperts", kind: "integer" },
      ),
    ).toEqual({ state: "value", text: "0" });
  });

  it("reports a field named in missing_fields as unknown", () => {
    expect(
      resolveFieldValue(
        { missing_fields: ["architecture"] },
        { ...textField, kind: "text" },
      ),
    ).toEqual({ state: "unknown" });
  });

  it("reports a field the server left out of both lists as not applicable", () => {
    // Expert counts on a dense checkpoint: the server omits them from
    // missing_fields on purpose, meaning they do not apply — which is a
    // different statement from "we looked and could not tell".
    expect(
      resolveFieldValue(
        {
          is_moe: false,
          field_sources: { is_moe: "auto" },
          missing_fields: [],
        },
        { key: "num_experts", labelKey: "numExperts", kind: "integer" },
      ),
    ).toEqual({ state: "notApplicable" });
  });

  it("falls back to unknown when the response states no provenance at all", () => {
    // A hand-written catalog carries neither list, so nothing can be concluded
    // from a field's absence beyond "not known".
    expect(
      resolveFieldValue(
        { parameter_count: "7B" },
        { ...textField, kind: "text" },
      ),
    ).toEqual({ state: "unknown" });
  });
});

describe("ModelInfoFields", () => {
  const parsed: ModelInfo = {
    architecture: "Qwen2ForCausalLM",
    num_attention_heads: 14,
    head_dim: 64,
    field_sources: {
      architecture: "auto",
      num_attention_heads: "auto",
      head_dim: "derived",
    },
    missing_fields: ["parameter_count"],
  };

  it("shows unknown rather than a blank for a field the server could not establish", () => {
    render(<ModelInfoFields info={parsed} />);

    const cell = screen.getByTestId("model-info-parameter_count");
    expect(cell.textContent).toContain(
      "model_registries.models.values.unknown",
    );
  });

  it("marks a derived field and leaves an auto one unmarked", () => {
    render(<ModelInfoFields info={parsed} />);

    expect(
      screen
        .getByTestId("model-info-head_dim")
        .querySelector(
          '[aria-label="model_registries.models.sources.derived"]',
        ),
    ).not.toBeNull();
    expect(
      screen
        .getByTestId("model-info-architecture")
        .textContent?.includes("model_registries.models.sources"),
    ).toBe(false);
  });

  it("marks a hand-filled field", () => {
    render(
      <ModelInfoFields
        info={{
          parameter_count: "7000000000",
          field_sources: { parameter_count: "manual" },
          missing_fields: [],
        }}
      />,
    );

    const cell = screen.getByTestId("model-info-parameter_count");
    expect(
      cell.querySelector(
        '[aria-label="model_registries.models.sources.manual"]',
      ),
    ).not.toBeNull();
    expect(cell.textContent).toContain("7,000,000,000");
  });

  it("invents nothing when the server established nothing", () => {
    const allMissing: ModelInfo = {
      missing_fields: [
        "architecture",
        "num_hidden_layers",
        "num_attention_heads",
        "num_key_value_heads",
        "head_dim",
        "max_position_embeddings",
        "context_length",
        "parameter_dtype",
        "is_moe",
        "num_experts",
        "num_experts_per_token",
        "quantization_bits",
        "parameter_count",
      ],
    };

    render(<ModelInfoFields info={allMissing} />);

    const container = screen.getByTestId("model-info-fields");
    // Every named field reads "unknown", and no digit is rendered anywhere:
    // nothing was guessed from the model's name or filled with a zero.
    expect(/\d/.test(container.textContent ?? "")).toBe(false);
  });

  it("offers the compact definition-table layout for detail drawers", () => {
    render(<ModelInfoFields info={parsed} variant="definition-table" />);

    expect(screen.getByTestId("model-info-fields").className).toContain(
      "sm:grid-cols-2",
    );
    expect(screen.getByTestId("model-info-architecture").className).toContain(
      "border-b",
    );
  });

  it("de-emphasizes unknown values and omits not-applicable compact rows", () => {
    render(
      <ModelInfoFields
        info={{
          is_moe: false,
          field_sources: { is_moe: "auto" },
          missing_fields: ["parameter_count"],
        }}
        variant="definition-table"
      />,
    );

    expect(
      screen.getByTestId("model-info-parameter_count").querySelector("span")
        ?.className,
    ).toContain("--nt-text-neutral-quaternary");
    expect(screen.queryByTestId("model-info-num_experts")).toBeNull();
    expect(screen.queryByTestId("model-info-num_experts_per_token")).toBeNull();
  });
});
