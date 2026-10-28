import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ModelInfoFields,
  resolveFieldValue,
} from "@/domains/model-registry/components/ModelInfoFields";
import type { ModelInfo } from "@/foundation/types/serving-types";

// SourceTag's Tooltip relies on the app-wide TooltipProvider mounted in
// BaseLayout; this test renders the component in isolation, so it stands in.
const renderWithTooltip = (ui: ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

describe("resolveFieldValue", () => {
  type Field = Parameters<typeof resolveFieldValue>[1];
  const field = (key: Field["key"], kind: Field["kind"]): Field => ({
    key,
    labelKey: key,
    kind,
  });

  it.each<[string, ModelInfo, Field, unknown]>([
    [
      "a value the server established",
      { architecture: "Qwen2ForCausalLM" },
      field("architecture", "text"),
      { state: "value", text: "Qwen2ForCausalLM" },
    ],
    [
      "a digit string, grouped",
      { parameter_count: "494032768" },
      field("parameter_count", "text"),
      { state: "value", text: "494,032,768" },
    ],
    [
      "a hand-written count, as written",
      { parameter_count: "72.7B" },
      field("parameter_count", "text"),
      { state: "value", text: "72.7B" },
    ],
    [
      "false as a value",
      { is_moe: false, missing_fields: ["parameter_count"] },
      field("is_moe", "boolean"),
      { state: "value", text: "false" },
    ],
    [
      "zero as a value",
      { num_experts: 0, missing_fields: [] },
      field("num_experts", "integer"),
      { state: "value", text: "0" },
    ],
    [
      "a field named in missing_fields as unknown",
      { missing_fields: ["architecture"] },
      field("architecture", "text"),
      { state: "unknown" },
    ],
    // The server omits e.g. expert counts on a dense checkpoint from
    // missing_fields on purpose: they do not apply.
    [
      "a field left out of both lists as not applicable",
      { is_moe: false, field_sources: { is_moe: "auto" }, missing_fields: [] },
      field("num_experts", "integer"),
      { state: "notApplicable" },
    ],
    // A hand-written catalog carries neither list: absence means only unknown.
    [
      "an absent field as unknown when no provenance is stated",
      { parameter_count: "7B" },
      field("architecture", "text"),
      { state: "unknown" },
    ],
  ])("reports %s", (_, info, spec, expected) => {
    expect(resolveFieldValue(info, spec)).toEqual(expected);
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
    renderWithTooltip(<ModelInfoFields info={parsed} />);

    const cell = screen.getByTestId("model-info-parameter_count");
    expect(cell.textContent).toContain(
      "model_registries.models.values.unknown",
    );
  });

  it("marks a derived field and leaves an auto one unmarked", () => {
    renderWithTooltip(<ModelInfoFields info={parsed} />);

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
    renderWithTooltip(
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

    renderWithTooltip(<ModelInfoFields info={allMissing} />);

    const container = screen.getByTestId("model-info-fields");
    // Every named field reads "unknown", and no digit is rendered anywhere:
    // nothing was guessed from the model's name or filled with a zero.
    expect(/\d/.test(container.textContent ?? "")).toBe(false);
  });

  it("omits not-applicable rows from the compact layout", () => {
    renderWithTooltip(
      <ModelInfoFields
        info={{
          is_moe: false,
          field_sources: { is_moe: "auto" },
          missing_fields: ["parameter_count"],
        }}
        variant="definition-table"
      />,
    );

    screen.getByTestId("model-info-parameter_count");
    expect(screen.queryByTestId("model-info-num_experts")).toBeNull();
    expect(screen.queryByTestId("model-info-num_experts_per_token")).toBeNull();
  });
});
