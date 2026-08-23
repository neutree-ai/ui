import { describe, expect, it } from "vitest";
import { buildAvailableClusterVersionsURL } from "./available-cluster-versions";

describe("buildAvailableClusterVersionsURL", () => {
  it.each(["ssh", "kubernetes"])(
    "includes the target registry for %s profiles",
    (clusterType) => {
      expect(
        buildAvailableClusterVersionsURL(
          clusterType,
          "default",
          "public-docker",
        ),
      ).toBe(
        `/clusters/available_versions?workspace=default&image_registry=public-docker&cluster_type=${clusterType}`,
      );
    },
  );

  it.each([
    [undefined, "default", "public-docker"],
    ["ssh", undefined, "public-docker"],
    ["ssh", "_all_", "public-docker"],
    ["ssh", "default", undefined],
    ["ssh", "default", ""],
    ["managed", "default", "public-docker"],
    ["SSH", "default", "public-docker"],
  ])(
    "does not create a request for an unsupported cluster type: %s",
    (clusterType, workspace, imageRegistry) => {
      expect(
        buildAvailableClusterVersionsURL(clusterType, workspace, imageRegistry),
      ).toBeUndefined();
    },
  );

  it("encodes workspace and registry names", () => {
    expect(
      buildAvailableClusterVersionsURL("ssh", "team one", "private/reg"),
    ).toBe(
      "/clusters/available_versions?workspace=team+one&image_registry=private%2Freg&cluster_type=ssh",
    );
  });
});
