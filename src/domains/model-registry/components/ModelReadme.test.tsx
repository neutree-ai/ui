import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModelReadme } from "@/domains/model-registry/components/ModelReadme";
import { useRegistryModelReadme } from "@/domains/model-registry/hooks/use-registry-model-readme";
import { RegistryModelError } from "@/foundation/lib/api/registry-models";

vi.mock("@/domains/model-registry/hooks/use-registry-model-readme", () => ({
  useRegistryModelReadme: vi.fn(),
}));

// The page shell, stubbed: it reaches refine's react-table, whose CommonJS
// lodash import vitest cannot resolve, and none of it is what this file is
// about. What is under test is the markdown pipeline.
vi.mock("@/foundation/components/ShowPage", () => ({
  ShowPage: {
    Section: ({ children }: { children?: ReactNode }) => (
      <section>{children}</section>
    ),
  },
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${Object.values(vars).join(",")}` : key,
  }),
}));

const modelRef = {
  workspace: "default",
  registry: "public-hugging-face",
  model: "org/model",
  version: "main",
};

const returns = (value: {
  content?: string;
  truncated?: boolean;
  isLoading?: boolean;
  error?: RegistryModelError | null;
}) => {
  vi.mocked(useRegistryModelReadme).mockReturnValue({
    readme:
      value.content === undefined
        ? null
        : { content: value.content, truncated: value.truncated ?? false },
    isLoading: value.isLoading ?? false,
    error: value.error ?? null,
  });
};

beforeEach(() => {
  vi.mocked(useRegistryModelReadme).mockReset();
});

describe("ModelReadme — a card is untrusted content", () => {
  it("renders raw HTML in a card as text, never as markup", () => {
    // The XSS acceptance for this feature, asserted directly rather than argued.
    // It holds because the pipeline has no HTML step in it: the server returns
    // the markdown as stored, and react-markdown builds elements from a parsed
    // tree with no `rehype-raw` to turn raw nodes back into markup. Adding that
    // plugin — anywhere in this repo — is what would break this test.
    returns({
      content: [
        "# Card",
        "",
        "<script>window.__pwned = true</script>",
        "",
        '<img src="x" onerror="window.__pwned = true">',
        "",
        '<iframe src="https://evil.invalid"></iframe>',
      ].join("\n"),
    });

    render(<ModelReadme modelRef={modelRef} />);

    const content = screen.getByTestId("readme-content");

    expect(content.querySelector("script")).toBeNull();
    expect(content.querySelector("iframe")).toBeNull();
    // No <img> either: the tag was written as raw HTML, so it is text.
    expect(content.querySelector("img")).toBeNull();
    // And it is visible as source, which is what "passed through as text" means.
    expect(content.textContent).toContain("<script>");
    expect(
      (globalThis as unknown as { __pwned?: boolean }).__pwned,
    ).toBeUndefined();
  });

  it("does not emit a javascript: link from a markdown link", () => {
    returns({ content: "[click](javascript:window.__pwned = true)" });

    render(<ModelReadme modelRef={modelRef} />);

    const link = screen.getByTestId("readme-content").querySelector("a");

    // The library's default URL transform drops the scheme rather than the
    // element, so what remains must not be executable.
    expect(link?.getAttribute("href") ?? "").not.toContain("javascript:");
  });

  it("sends card links out with no referrer", () => {
    returns({ content: "[hub](https://example.invalid/model)" });

    render(<ModelReadme modelRef={modelRef} />);

    const link = screen.getByTestId("readme-content").querySelector("a");

    expect(link?.getAttribute("rel")).toContain("noreferrer");
    expect(link?.getAttribute("target")).toBe("_blank");
  });
});

describe("ModelReadme — what the server said", () => {
  it("renders nothing at all when the registry serves no cards", () => {
    // Not an empty section headed "Model card": that reads as the card being
    // missing rather than the feature being absent for this kind of registry.
    returns({
      error: new RegistryModelError(400, {
        reason: "not_supported",
        message: "operation not supported by this model registry",
      }),
    });

    const { container } = render(<ModelReadme modelRef={modelRef} />);

    expect(container.textContent).toBe("");
  });

  it("renders nothing when the model simply has no card", () => {
    returns({
      error: new RegistryModelError(404, {
        reason: "not_found",
        message: "Model x:v1 has no README",
      }),
    });

    const { container } = render(<ModelReadme modelRef={modelRef} />);

    expect(container.textContent).toBe("");
  });

  it("passes on the server's wording for any other failure", () => {
    returns({
      error: new RegistryModelError(429, {
        reason: "rate_limited",
        message: "the registry is rate limiting us",
      }),
    });

    render(<ModelReadme modelRef={modelRef} />);

    expect(screen.getByTestId("readme-unavailable").textContent).toBe(
      "the registry is rate limiting us",
    );
  });

  it("flags a card the server had to cut short", () => {
    returns({ content: "# Card", truncated: true });

    render(<ModelReadme modelRef={modelRef} />);

    expect(screen.getByTestId("readme-truncated")).toBeDefined();
  });

  it("hides the front matter every hub card starts with", () => {
    returns({
      content: "---\nlicense: apache-2.0\n---\n\n# Qwen2.5",
    });

    render(<ModelReadme modelRef={modelRef} />);

    const content = screen.getByTestId("readme-content");

    expect(content.textContent).toContain("Qwen2.5");
    expect(content.textContent).not.toContain("license: apache-2.0");
  });

  it("treats a card of pure whitespace as no card", () => {
    returns({ content: "   \n\n" });

    render(<ModelReadme modelRef={modelRef} />);

    expect(screen.getByTestId("readme-empty")).toBeDefined();
  });
});
