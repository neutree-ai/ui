import { describe, expect, it } from "vitest";
import { splitModelCard } from "@/domains/model-registry/lib/model-card";

describe("splitModelCard", () => {
  it("takes the front matter off a hub model card", () => {
    // Every card on a public hub looks like this. Handed to a markdown renderer
    // whole, the opening fence reads as a rule and the closing one as a heading,
    // so the licence and tags arrive as a slab of bold text above the card.
    const { frontMatter, body } = splitModelCard(
      [
        "---",
        "license: apache-2.0",
        "tags:",
        "  - text-generation",
        "---",
        "",
        "# Qwen",
      ].join("\n"),
    );

    expect(frontMatter).toContain("license: apache-2.0");
    expect(body).toBe("\n# Qwen");
  });

  it("handles CRLF line endings", () => {
    const { frontMatter, body } = splitModelCard(
      "---\r\nlicense: mit\r\n---\r\n# Model",
    );

    expect(frontMatter).toBe("license: mit");
    expect(body).toBe("# Model");
  });

  it("handles a card that is nothing but front matter", () => {
    const { frontMatter, body } = splitModelCard("---\nlicense: mit\n---");

    expect(frontMatter).toBe("license: mit");
    expect(body).toBe("");
  });

  it("leaves a card with no front matter untouched", () => {
    const markdown = "# Model\n\nSome prose.";

    expect(splitModelCard(markdown)).toEqual({
      frontMatter: null,
      body: markdown,
    });
  });

  it("leaves a lone rule alone rather than eating the card", () => {
    // An opening `---` with no closing fence is a thematic break the author
    // wrote. Matching greedily here would swallow prose as metadata.
    const markdown = "---\n\n# Model";

    expect(splitModelCard(markdown).frontMatter).toBeNull();
    expect(splitModelCard(markdown).body).toBe(markdown);
  });

  it("does not treat a rule further down the card as front matter", () => {
    const markdown = "# Model\n\n---\n\nlicense: mit\n\n---\n";

    expect(splitModelCard(markdown).frontMatter).toBeNull();
  });
});
