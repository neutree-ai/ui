import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  BreakableReference,
  referenceSegments,
} from "@/foundation/components/BreakableReference";

describe("referenceSegments", () => {
  it("breaks after a slash and before a colon", () => {
    // Where a reader's eye already separates a reference, so a wrapped line
    // does not split a repository name down the middle.
    expect(
      referenceSegments("registry.example.com/team/neutree/flex-engine:v0.1.2"),
    ).toEqual([
      "registry.example.com/",
      "team/",
      "neutree/",
      "flex-engine",
      ":v0.1.2",
    ]);
  });

  it("keeps a slash with the segment it closes", () => {
    // Otherwise a wrap can leave a line starting with a stray separator.
    expect(referenceSegments("a/b")).toEqual(["a/", "b"]);
  });

  it("leaves a value with nothing to break at in one piece", () => {
    expect(referenceSegments("nginx")).toEqual(["nginx"]);
    expect(referenceSegments("8192")).toEqual(["8192"]);
  });

  it("survives an empty value", () => {
    expect(referenceSegments("")).toEqual([]);
  });

  it("does not lose or duplicate any character", () => {
    // The rendered text has to stay the reference it was given.
    for (const value of [
      "registry:5000/team/x:v1",
      "docker.io/library/nginx:latest",
      "://weird//",
      "a",
    ]) {
      expect(referenceSegments(value).join("")).toBe(value);
    }
  });
});

describe("BreakableReference", () => {
  it("offers a break opportunity at every separator", () => {
    // A reference has no spaces, and neither `/` nor `:` is a break point on
    // its own -- so without these the string cannot wrap at all, refuses to
    // shrink, and overflows whatever holds it.
    const { container } = render(
      <BreakableReference value="registry.example.com/team/x:v1" />,
    );

    expect(container.querySelectorAll("wbr")).toHaveLength(4);
  });

  it("renders the reference unchanged as text", () => {
    // The break hints must not alter what is read or copied.
    const { container } = render(
      <BreakableReference value="registry.example.com/team/neutree/x:v0.1.2" />,
    );

    expect(container.textContent).toBe(
      "registry.example.com/team/neutree/x:v0.1.2",
    );
  });
});
