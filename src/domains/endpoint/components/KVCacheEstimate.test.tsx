import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KVCacheEstimate } from "@/domains/endpoint/components/KVCacheEstimate";
import type { ModelInfoRead } from "@/foundation/lib/model-info-read";
import type { ModelInfo } from "@/foundation/types/serving-types";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrVars?: unknown, vars?: unknown) => {
      const values = (vars ?? fallbackOrVars) as
        | Record<string, unknown>
        | undefined;

      return values && typeof values === "object"
        ? `${key} ${JSON.stringify(values)}`
        : key;
    },
  }),
}));

/** deepseek-ai/DeepSeek-V3, as the registry reports it. */
const deepseekV3: ModelInfo = {
  num_hidden_layers: 61,
  num_key_value_heads: 128,
  head_dim: 56,
  kv_lora_rank: 512,
  qk_rope_head_dim: 64,
  max_position_embeddings: 163840,
  parameter_dtype: "bfloat16",
  field_sources: { head_dim: "derived" },
};

const ready = (info: ModelInfo): ModelInfoRead => ({ state: "ready", info });

const state = () =>
  screen.getByTestId("kv-cache-estimate").getAttribute("data-state");

const tokenInput = () =>
  screen.getByTestId("kv-cache-tokens") as HTMLInputElement;

describe("KVCacheEstimate", () => {
  it("estimates from the checkpoint's own context length and dtype", () => {
    render(<KVCacheEstimate read={ready(deepseekV3)} />);

    const panel = screen.getByTestId("kv-cache-estimate");

    // Latent layout, defaults taken from the model: 163840 tokens × 1 sequence.
    expect(panel.getAttribute("data-state")).toBe("latent");
    expect(tokenInput().value).toBe("163840");
    expect(panel.textContent).toContain("70,272");
    expect(screen.queryByTestId("kv-cache-refusal")).toBeNull();
  });

  it("names the field it is missing instead of estimating without it", () => {
    render(
      <KVCacheEstimate
        read={ready({ ...deepseekV3, kv_lora_rank: undefined })}
      />,
    );

    expect(state()).toBe("missing-fields");
    expect(screen.getByTestId("kv-cache-refusal").textContent).toContain(
      "kv_lora_rank",
    );
  });

  it("estimates a mixed sliding/full checkpoint instead of refusing it", () => {
    render(
      <KVCacheEstimate
        read={ready({
          num_hidden_layers: 24,
          num_key_value_heads: 8,
          head_dim: 64,
          max_position_embeddings: 131072,
          parameter_dtype: "bfloat16",
          layer_types: ["sliding_attention", "full_attention"],
          sliding_window: 128,
        })}
      />,
    );

    expect(state()).toBe("mixed_full_sliding_gqa");
    // The windowed layers are shown as their own part of the cache, because
    // they stop growing where the full ones do not.
    expect(
      screen.queryByTestId("kv-cache-component-sliding_kv"),
    ).not.toBeNull();
    expect(screen.queryByTestId("kv-cache-refusal")).toBeNull();
  });

  it("refuses a layer kind none of the formulas describes", () => {
    render(
      <KVCacheEstimate
        read={ready({
          num_hidden_layers: 24,
          num_key_value_heads: 8,
          head_dim: 64,
          max_position_embeddings: 131072,
          parameter_dtype: "bfloat16",
          layer_types: ["mamba", "full_attention"],
        })}
      />,
    );

    expect(state()).toBe("layer-types");
    expect(screen.getByTestId("kv-cache-refusal").textContent).toContain(
      "mamba",
    );
  });

  it("says why it will not size a compression rate it has no evidence for", () => {
    render(
      <KVCacheEstimate
        read={ready({
          num_hidden_layers: 4,
          num_key_value_heads: 1,
          head_dim: 512,
          sliding_window: 128,
          index_head_dim: 128,
          compress_ratios: [128, 8, 128, 8],
          max_position_embeddings: 1048576,
          parameter_dtype: "bfloat16",
        })}
      />,
    );

    expect(state()).toBe("compression-rates");
    expect(screen.getByTestId("kv-cache-refusal").textContent).toContain("8");
  });

  it("leaves the token count empty when the checkpoint states no context length", () => {
    // The one input with a model-derived default: without a stated context
    // length it stays blank and the panel asks for it, rather than estimating
    // against a number nobody chose.
    render(
      <KVCacheEstimate
        read={ready({ ...deepseekV3, max_position_embeddings: undefined })}
      />,
    );

    expect(tokenInput().value).toBe("");
    expect(state()).toBe("invalid-input");
  });

  it("shows nothing at all until a model is selected", () => {
    render(<KVCacheEstimate read={{ state: "none" }} />);

    expect(screen.queryByTestId("kv-cache-estimate")).toBeNull();
  });

  it("says the read is in flight without offering inputs to fill in", () => {
    render(<KVCacheEstimate read={{ state: "loading" }} />);

    expect(state()).toBe("loading");
    expect(screen.getByTestId("kv-cache-notice").textContent).toContain(
      "endpoints.kvCache.reading",
    );
    expect(screen.queryByTestId("kv-cache-tokens")).toBeNull();
  });

  it.each([
    {
      reason: "unauthorized" as const,
      state: "unread-unauthorized",
      key: "endpoints.kvCache.unread.unauthorized",
    },
    {
      reason: "not-found" as const,
      state: "unread-not-found",
      key: "endpoints.kvCache.unread.not-found",
    },
    {
      reason: "unavailable" as const,
      state: "unread-unavailable",
      key: "endpoints.kvCache.unread.unavailable",
    },
  ])("words a $reason read failure as its own case", (testCase) => {
    render(
      <KVCacheEstimate
        read={{
          state: "unread",
          reason: testCase.reason,
          message: "the registry said so",
        }}
      />,
    );

    expect(state()).toBe(testCase.state);

    const notice = screen.getByTestId("kv-cache-notice").textContent ?? "";

    expect(notice).toContain(testCase.key);
    // The server's own wording is kept: it names the specific obstacle.
    expect(notice).toContain("the registry said so");
    // A read that never happened must not be reported as a missing field.
    expect(notice).not.toContain("missingFields");
  });

  it("distinguishes a checkpoint it could not parse from one that omits a field", () => {
    render(<KVCacheEstimate read={{ state: "unparsed" }} />);

    expect(state()).toBe("unparsed");
    expect(screen.getByTestId("kv-cache-notice").textContent).toContain(
      "endpoints.kvCache.unparsed",
    );

    render(<KVCacheEstimate read={{ state: "unreported" }} />);

    expect(screen.getAllByTestId("kv-cache-notice")[1]?.textContent).toContain(
      "endpoints.kvCache.unreported",
    );
  });
});
