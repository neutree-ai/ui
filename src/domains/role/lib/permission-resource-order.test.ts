import { describe, expect, it } from "vitest";
import { sortPermissionResources } from "./permission-resource-order";

describe("sortPermissionResources", () => {
  it("puts log forwarding right after the group holding the Access Log permission", () => {
    expect(
      sortPermissionResources([
        "workspace",
        "log_sink",
        "model",
        "image_registry",
        "external_endpoint",
        "endpoint",
      ]),
    ).toEqual([
      "endpoint",
      "external_endpoint",
      "log_sink",
      "image_registry",
      "model",
      "workspace",
    ]);
  });

  it("falls back to alphabetical order when the anchor group is absent", () => {
    expect(sortPermissionResources(["model", "log_sink", "cluster"])).toEqual([
      "cluster",
      "log_sink",
      "model",
    ]);
  });
});
