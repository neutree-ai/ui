import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  FeatureSelection,
  RecipeFeature,
} from "@/foundation/recipe/types";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

import { FeaturePicker } from "./FeaturePicker";

const imageFeature = (
  overrides: Partial<RecipeFeature> = {},
): RecipeFeature => ({
  name: "image",
  type: "input",
  input: { value_type: "string", default: "<your-registry>/thing:v1" },
  engine_args: { image: "${value}" },
  ...overrides,
});

function renderPicker({
  features = [imageFeature()],
  value = [] as FeatureSelection[],
  inputAddon = undefined as Parameters<typeof FeaturePicker>[0]["inputAddon"],
} = {}) {
  const onChange = vi.fn();

  render(
    <FeaturePicker
      features={features}
      value={value}
      onChange={onChange}
      inputAddon={inputAddon}
    />,
  );

  return { onChange };
}

/** An addon that stands in for the registry explorer: it hands back a whole
 * reference in one go, which is what the real one does. */
const explorerAddon =
  (applies = true) =>
  (_feature: RecipeFeature, { onChange }: { onChange: (v: string) => void }) =>
    applies ? (
      <button
        type="button"
        data-testid="addon"
        onClick={() => onChange("registry.example.com/team/x:v1")}
      >
        explore
      </button>
    ) : null;

describe("FeaturePicker input addons", () => {
  it("renders no addon when the caller supplies none", () => {
    renderPicker();

    expect(screen.queryByTestId("addon")).toBeNull();
    expect(screen.getByLabelText("image")).toBeTruthy();
  });

  it("renders one beside the feature's own input, and takes its answer", () => {
    const { onChange } = renderPicker({ inputAddon: explorerAddon() });

    expect(screen.getByLabelText("image")).toBeTruthy();

    fireEvent.click(screen.getByTestId("addon"));

    expect(onChange).toHaveBeenCalledWith([
      { name: "image", value: "registry.example.com/team/x:v1" },
    ]);
  });

  it("leaves a feature the caller declines exactly as it was", () => {
    renderPicker({ inputAddon: explorerAddon(false) });

    expect(screen.queryByTestId("addon")).toBeNull();
    expect(screen.getByLabelText("image")).toBeTruthy();
  });

  it("keeps the author's suggestions alongside the addon", () => {
    // A feature's suggestions are the catalog author's recommendations and the
    // addon is a way to go and find something else. They are complementary, so
    // offering one must not cost the other.
    renderPicker({
      features: [
        imageFeature({
          input: {
            value_type: "string",
            suggestions: ["acme/known:v1"],
          },
        }),
      ],
      inputAddon: explorerAddon(),
    });

    expect(screen.getByTestId("addon")).toBeTruthy();
    // SuggestInput renders a combobox trigger rather than a bare text box.
    expect(screen.getByRole("combobox", { name: "image" })).toBeTruthy();
  });

  it("offers nothing extra on a feature that is not a free input", () => {
    renderPicker({
      features: [{ name: "airgap", type: "boolean" } as RecipeFeature],
      inputAddon: explorerAddon(),
    });

    expect(screen.queryByTestId("addon")).toBeNull();
  });
});

// A feature's description used to sit as a permanent line under every field,
// which is exactly what made a form with several features (context window,
// concurrency, tool-calling, ...) read as dense. It now lives behind the same
// hover-hint affordance InfoHint offers elsewhere, so the label row stays one
// line and the explanation is still there for whoever wants it.
describe("FeaturePicker feature descriptions", () => {
  it("keeps a feature's description out of the label row, offering it via hover hint", async () => {
    renderPicker({
      features: [
        imageFeature({
          name: "max-model-len",
          display_name: "Context window",
          description:
            "Max sequence length (tokens) — pick a preset or type your own (native ceiling 262144).",
        }),
      ],
    });

    expect(screen.queryByText(/Max sequence length/)).toBeNull();

    const hint = screen.getByRole("button", {
      name: "Max sequence length (tokens) — pick a preset or type your own (native ceiling 262144).",
    });
    fireEvent.focus(hint);

    expect((await screen.findByRole("tooltip")).textContent).toBe(
      "Max sequence length (tokens) — pick a preset or type your own (native ceiling 262144).",
    );
  });

  it("renders no hint when the feature states no description", () => {
    renderPicker({ features: [imageFeature({ description: undefined })] });

    expect(screen.queryByRole("button", { name: /./ })).toBeNull();
  });
});
