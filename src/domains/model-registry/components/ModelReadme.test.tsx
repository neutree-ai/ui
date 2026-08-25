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
  it("drops the tags that would run or embed something", () => {
    // Half of the XSS acceptance for this feature, asserted rather than argued.
    // The card's HTML *is* rendered, so what carries the safety is the
    // allow-list: a tag not on it never becomes an element, and `script` is
    // stripped with its contents rather than left behind as text.
    returns({
      content: [
        "# Card",
        "",
        "<script>window.__pwned = true</script>",
        "",
        '<iframe src="https://evil.invalid"></iframe>',
        "",
        '<object data="https://evil.invalid"></object>',
        "",
        '<form action="https://evil.invalid"><input type="text" /></form>',
      ].join("\n"),
    });

    render(<ModelReadme modelRef={modelRef} />);

    const content = screen.getByTestId("readme-content");

    expect(content.querySelector("script")).toBeNull();
    expect(content.querySelector("iframe")).toBeNull();
    expect(content.querySelector("object")).toBeNull();
    expect(content.querySelector("form")).toBeNull();
    expect(content.textContent).not.toContain("window.__pwned");
    expect(
      (globalThis as unknown as { __pwned?: boolean }).__pwned,
    ).toBeUndefined();
  });

  it("strips the attributes a card could act or paint through", () => {
    // The other half: the tags here are allowed, and it is the attributes that
    // would do the damage. An event handler is code, and inline CSS is how a
    // card would cover the page it is embedded in.
    returns({
      content: [
        '<img src="https://example.invalid/logo.png" onerror="window.__pwned = true" alt="logo">',
        "",
        '<div style="position:fixed;inset:0;background:red" onclick="window.__pwned = true">hi</div>',
      ].join("\n"),
    });

    render(<ModelReadme modelRef={modelRef} />);

    const content = screen.getByTestId("readme-content");
    const image = content.querySelector("img");
    const div = content.querySelector("div");

    expect(image).not.toBeNull();
    expect(image?.getAttribute("onerror")).toBeNull();
    expect(div?.getAttribute("style")).toBeNull();
    expect(div?.getAttribute("onclick")).toBeNull();
    expect(
      (globalThis as unknown as { __pwned?: boolean }).__pwned,
    ).toBeUndefined();
  });

  it("renders the HTML hub cards are actually written with", () => {
    // The reason the pipeline renders HTML at all. Passed through as text, the
    // top of a typical card is a wall of angle brackets.
    returns({
      content: [
        '<div align="center">',
        '  <img src="https://example.invalid/logo.png" width="200" alt="logo">',
        "  <p><b>Qwen2.5</b></p>",
        "</div>",
        "",
        "<details><summary>Benchmarks</summary>",
        "",
        "**mmlu** 86.1",
        "",
        "</details>",
      ].join("\n"),
    });

    render(<ModelReadme modelRef={modelRef} />);

    const content = screen.getByTestId("readme-content");

    expect(content.querySelector("div")?.getAttribute("align")).toBe("center");
    expect(content.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.invalid/logo.png",
    );
    expect(content.querySelector("img")?.getAttribute("width")).toBe("200");
    expect(content.querySelector("details")).not.toBeNull();
    // Markdown inside the raw block is still markdown: `rehype-raw` reassembles
    // the two into one tree rather than treating the span between the tags as
    // opaque text.
    expect(content.querySelector("details strong")?.textContent).toBe("mmlu");
    expect(content.textContent).not.toContain("<div");
  });

  it("does not emit a javascript: link, written either way", () => {
    returns({
      content: [
        "[markdown](javascript:alert(1))",
        "",
        '<a href="javascript:alert(1)">html</a>',
      ].join("\n"),
    });

    render(<ModelReadme modelRef={modelRef} />);

    const links = screen.getByTestId("readme-content").querySelectorAll("a");

    expect(links).toHaveLength(2);

    for (const link of links) {
      expect(link.getAttribute("href") ?? "").not.toContain("javascript:");
    }
  });

  it("sends card links out with no referrer, and on this app's terms", () => {
    // Including the ones written as raw HTML: every link is rebuilt by the
    // component, so a card cannot choose its own target or rel.
    returns({
      content: [
        "[hub](https://example.invalid/model)",
        "",
        '<a href="https://example.invalid/other" target="_self" rel="opener">html</a>',
      ].join("\n"),
    });

    render(<ModelReadme modelRef={modelRef} />);

    const links = screen.getByTestId("readme-content").querySelectorAll("a");

    expect(links).toHaveLength(2);

    for (const link of links) {
      expect(link.getAttribute("rel")).toContain("noreferrer");
      expect(link.getAttribute("target")).toBe("_blank");
    }
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
