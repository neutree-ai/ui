import { describe, expect, it } from "vitest";
import {
  describeErrorBody,
  parseContentRangeTotal,
} from "@/foundation/lib/api/registry-models";

describe("parseContentRangeTotal", () => {
  it("reads the total out of a populated range", () => {
    expect(parseContentRangeTotal("0-1/5")).toBe(5);
    expect(parseContentRangeTotal("2-3/5")).toBe(5);
  });

  it("reads the total of an empty page", () => {
    expect(parseContentRangeTotal("*/0")).toBe(0);
  });

  it("reports an uncountable registry as unknown, not as zero", () => {
    // A public registry cannot say how many models matched. Answering 0 here
    // would tell a caller the listing had ended before it began.
    expect(parseContentRangeTotal("0-1/*")).toBeNull();
    expect(parseContentRangeTotal("*/*")).toBeNull();
  });

  it("treats a missing or unparseable header as unknown", () => {
    expect(parseContentRangeTotal(null)).toBeNull();
    expect(parseContentRangeTotal("")).toBeNull();
    expect(parseContentRangeTotal("0-1")).toBeNull();
    expect(parseContentRangeTotal("0-1/many")).toBeNull();
  });
});

describe("describeErrorBody", () => {
  it("uses the server's message when there is one", () => {
    expect(describeErrorBody({ message: "no such model" }, "Not Found")).toBe(
      "no such model",
    );
  });

  it("reports a refusal in the permission check's own words", () => {
    // That layer answers {error, required} rather than {message}. The UI does
    // not decide who may write, so a refusal has to arrive with its reason
    // rather than as a bare "Forbidden".
    expect(
      describeErrorBody(
        { error: "insufficient permissions", required: "model:push" },
        "Forbidden",
      ),
    ).toBe("insufficient permissions (model:push)");

    expect(
      describeErrorBody({ error: "insufficient permissions" }, "Forbidden"),
    ).toBe("insufficient permissions");
  });

  it("falls back to the status line when the body says nothing", () => {
    expect(describeErrorBody({}, "Bad Gateway")).toBe("Bad Gateway");
  });
});
