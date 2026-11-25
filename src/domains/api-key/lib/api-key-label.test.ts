import { describe, expect, it } from "vitest";
import { apiKeyLabelDetails, apiKeyLabelParts } from "./api-key-label";

describe("apiKeyLabelParts", () => {
  it("keeps the technical name beside a display name", () => {
    expect(
      apiKeyLabelParts({
        name: "apikey-1",
        displayName: "Support",
        description: "Production calls",
      }),
    ).toEqual({
      primary: "Support",
      technicalName: "apikey-1",
      description: "Production calls",
    });
  });

  it("falls back to the technical name without repeating it", () => {
    expect(apiKeyLabelParts({ name: "apikey-1", displayName: "  " })).toEqual({
      primary: "apikey-1",
      technicalName: null,
      description: null,
    });
    expect(
      apiKeyLabelParts({ name: "same", displayName: "same" }).technicalName,
    ).toBeNull();
  });

  it("drops a blank description and tolerates an unresolved key", () => {
    expect(apiKeyLabelParts({ description: "  " })).toEqual({
      primary: "",
      technicalName: null,
      description: null,
    });
  });
});

describe("apiKeyLabelDetails", () => {
  it("lists only the lines that exist", () => {
    expect(
      apiKeyLabelDetails(
        { primary: "Support", technicalName: "apikey-1", description: null },
        "Name",
      ),
    ).toEqual(["Support", "Name: apikey-1"]);
    expect(
      apiKeyLabelDetails(
        { primary: "apikey-1", technicalName: null, description: "d" },
        "Name",
      ),
    ).toEqual(["apikey-1", "d"]);
  });
});
