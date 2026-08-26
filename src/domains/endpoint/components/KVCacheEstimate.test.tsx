import { fireEvent, render, screen } from "@testing-library/react";
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

const sequenceInput = () =>
  screen.getByTestId("kv-cache-sequences") as HTMLInputElement;

/** Qwen/Qwen3.6-27B: a 262144-token ceiling no ordinary deployment opens. */
const qwen36: ModelInfo = {
  num_hidden_layers: 64,
  num_key_value_heads: 4,
  head_dim: 256,
  max_position_embeddings: 262144,
  parameter_dtype: "bfloat16",
  field_sources: { max_position_embeddings: "auto" },
};

describe("KVCacheEstimate", () => {
  it("estimates from the checkpoint's own context length and dtype", () => {
    render(<KVCacheEstimate read={ready(deepseekV3)} />);

    const panel = screen.getByTestId("kv-cache-estimate");

    // Latent layout, defaults taken from the model: 163840 tokens × 1 sequence.
    expect(panel.getAttribute("data-state")).toBe("latent");
    expect(tokenInput().value).toBe("163840");
    expect(screen.queryByTestId("kv-cache-refusal")).toBeNull();

    // The bytes-per-token figure is part of the result, so it is on the face of
    // the panel whether or not the formula is open. On this checkpoint it also
    // happens to equal the per-layer product (61 x 576 x 2), which makes it
    // useless as a marker for "the formula is showing" — the factor labels are
    // the thing that only exists inside the expansion.
    expect(panel.textContent).toContain("70,272");

    // The multiplied-out formula is reference material, not something the
    // reader needs in order to act, so it starts closed.
    expect(screen.queryByTestId("kv-cache-components")).toBeNull();
    expect(panel.textContent).not.toContain(
      "endpoints.kvCache.factors.kv_lora_rank",
    );

    fireEvent.click(screen.getByTestId("kv-cache-formula-toggle"));

    expect(screen.queryByTestId("kv-cache-components")).not.toBeNull();
    expect(panel.textContent).toContain(
      "endpoints.kvCache.factors.kv_lora_rank",
    );
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
    expect(screen.queryByTestId("kv-cache-refusal")).toBeNull();

    // The windowed layers are their own part of the cache, because they stop
    // growing where the full ones do not — visible once the formula is opened.
    fireEvent.click(screen.getByTestId("kv-cache-formula-toggle"));

    expect(
      screen.queryByTestId("kv-cache-component-sliding_kv"),
    ).not.toBeNull();
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

describe("KVCacheEstimate starting values", () => {
  it("starts from the context and concurrency this deployment states", () => {
    render(
      <KVCacheEstimate
        read={ready(qwen36)}
        engineArgs={{ maxModelLen: 32768, maxNumSeqs: 16 }}
      />,
    );

    // Not the checkpoint's 262144 ceiling: an eight-fold difference, and the
    // form is asking what this deployment needs.
    expect(tokenInput().value).toBe("32768");
    expect(sequenceInput().value).toBe("16");

    // And it is marked as coming from the deployment, so a reader cannot take
    // it for something the checkpoint vouched for.
    const panel = screen.getByTestId("kv-cache-estimate");

    expect(panel.textContent).toContain("endpoints.kvCache.sources.deployment");
  });

  it("falls back to the checkpoint when the deployment states neither", () => {
    render(<KVCacheEstimate read={ready(qwen36)} />);

    expect(tokenInput().value).toBe("262144");
    expect(sequenceInput().value).toBe("1");
    expect(screen.getByTestId("kv-cache-estimate").textContent).not.toContain(
      "endpoints.kvCache.sources.deployment",
    );
  });

  it("falls back per field, not all or nothing", () => {
    render(
      <KVCacheEstimate
        read={ready(qwen36)}
        engineArgs={{ maxModelLen: null, maxNumSeqs: 8 }}
      />,
    );

    expect(tokenInput().value).toBe("262144");
    expect(sequenceInput().value).toBe("8");
  });

  it("re-derives when a feature change moves the engine args", () => {
    // Switching a recipe feature recomposes engine_args; a default computed
    // once at mount would leave the panel showing the old context length next
    // to the control that just changed it.
    const { rerender } = render(
      <KVCacheEstimate
        read={ready(qwen36)}
        engineArgs={{ maxModelLen: 32768, maxNumSeqs: 16 }}
      />,
    );

    expect(tokenInput().value).toBe("32768");

    rerender(
      <KVCacheEstimate
        read={ready(qwen36)}
        engineArgs={{ maxModelLen: 131072, maxNumSeqs: 4 }}
      />,
    );

    expect(tokenInput().value).toBe("131072");
    expect(sequenceInput().value).toBe("4");
  });

  it("stops following once the user has typed in the field", () => {
    const { rerender } = render(
      <KVCacheEstimate
        read={ready(qwen36)}
        engineArgs={{ maxModelLen: 32768, maxNumSeqs: 16 }}
      />,
    );

    fireEvent.change(tokenInput(), { target: { value: "4096" } });
    expect(tokenInput().value).toBe("4096");

    rerender(
      <KVCacheEstimate
        read={ready(qwen36)}
        engineArgs={{ maxModelLen: 131072, maxNumSeqs: 4 }}
      />,
    );

    // The user asked a what-if; overwriting it would destroy an input they
    // cannot get back, with nothing on screen to say why.
    expect(tokenInput().value).toBe("4096");
    // The field they did not touch still follows.
    expect(sequenceInput().value).toBe("4");
  });

  it("marks an edited field as the user's rather than the deployment's", () => {
    render(
      <KVCacheEstimate
        read={ready(qwen36)}
        engineArgs={{ maxModelLen: 32768, maxNumSeqs: null }}
      />,
    );

    expect(screen.getByTestId("kv-cache-estimate").textContent).toContain(
      "endpoints.kvCache.sources.deployment",
    );

    fireEvent.change(tokenInput(), { target: { value: "4096" } });

    expect(screen.getByTestId("kv-cache-estimate").textContent).not.toContain(
      "endpoints.kvCache.sources.deployment",
    );
  });
});

describe("KVCacheEstimate disclosure", () => {
  const open = () =>
    screen.getByTestId("kv-cache-formula-toggle") as HTMLButtonElement;

  it("keeps the result and the basis visible without opening anything", () => {
    render(<KVCacheEstimate read={ready(deepseekV3)} />);

    const panel = screen.getByTestId("kv-cache-estimate");

    // The total and the family label are the answer. The basis is the trust
    // signal: a number that does not say what shape it took the model to be is
    // one a reader has no way to judge, so it is not hidden behind anything.
    expect(panel.textContent).toContain("GB");
    expect(panel.textContent).toContain("endpoints.kvCache.families.latent");
    expect(panel.textContent).toContain(
      "endpoints.kvCache.familyBasis.latent_widths",
    );
    expect(screen.queryByTestId("kv-cache-components")).toBeNull();
  });

  it("opens and closes the formula, and says which it will do", () => {
    render(<KVCacheEstimate read={ready(deepseekV3)} />);

    expect(open().textContent).toBe("endpoints.kvCache.showFormula");
    expect(open().getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(open());

    expect(open().textContent).toBe("endpoints.kvCache.hideFormula");
    expect(open().getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByTestId("kv-cache-components")).not.toBeNull();

    fireEvent.click(open());

    expect(screen.queryByTestId("kv-cache-components")).toBeNull();
  });

  it("is a real button, so keyboard and touch reach it as well as a pointer", () => {
    // The formula is what a reader checks the arithmetic against. Putting it
    // behind hover alone would hand it to mouse users and nobody else.
    render(<KVCacheEstimate read={ready(deepseekV3)} />);

    expect(open().tagName).toBe("BUTTON");

    open().focus();
    expect(document.activeElement).toBe(open());

    fireEvent.keyDown(open(), { key: "Enter" });
    fireEvent.keyUp(open(), { key: "Enter" });
    fireEvent.click(open());

    expect(screen.queryByTestId("kv-cache-components")).not.toBeNull();
  });

  it("shows a refusal in full, with nothing to open", () => {
    // A refusal is what the reader has to act on — supply a token, pick another
    // model, fill the field in by hand — so it is never behind a disclosure.
    render(
      <KVCacheEstimate
        read={ready({ ...deepseekV3, kv_lora_rank: undefined })}
      />,
    );

    expect(screen.getByTestId("kv-cache-refusal").textContent).toContain(
      "kv_lora_rank",
    );
    expect(screen.queryByTestId("kv-cache-formula-toggle")).toBeNull();
  });

  it("shows a read failure in full, with nothing to open", () => {
    render(
      <KVCacheEstimate
        read={{ state: "unread", reason: "unauthorized", message: null }}
      />,
    );

    expect(screen.getByTestId("kv-cache-notice").textContent).toContain(
      "endpoints.kvCache.unread.unauthorized",
    );
    expect(screen.queryByTestId("kv-cache-formula-toggle")).toBeNull();
  });
});
