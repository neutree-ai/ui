import { describe, expect, it } from "vitest";
import { CATALOG_ORIGIN_ANNOTATION } from "@/domains/endpoint/lib/catalog-origin";
import { makeEndpoint } from "@/domains/endpoint/testing/builders";
import { fieldKeys, fieldValue } from "@/foundation/testing/detail-fields";
import { endpointIdentityFields, endpointRuntimeFields } from "./detail-fields";

describe("endpointIdentityFields", () => {
  it("names the catalog only for an endpoint deployed from one", () => {
    const deployed = makeEndpoint({
      metadata: { annotations: { [CATALOG_ORIGIN_ANNOTATION]: "qwen-chat" } },
    });

    expect(fieldKeys(endpointIdentityFields(makeEndpoint()))).not.toContain(
      "modelCatalog",
    );
    expect(fieldKeys(endpointIdentityFields(deployed))).toContain(
      "modelCatalog",
    );
  });
});

describe("endpointRuntimeFields", () => {
  it.each([
    { replicas: null, keys: ["servedModels", "replicas"], count: 1 },
    {
      replicas: { num: 2 },
      keys: ["servedModels", "replicas", "scheduler"],
      count: 2,
    },
  ])("shows $count replicas as $keys", ({ replicas, keys, count }) => {
    const endpoint = makeEndpoint({ spec: { replicas } });
    const fields = endpointRuntimeFields(endpoint);

    expect(fieldKeys(fields)).toEqual(keys);
    expect(fieldValue(fields, "replicas", endpoint)).toBe(count);
  });

  it("names an unset scheduler as unavailable", () => {
    const endpoint = makeEndpoint({ spec: { replicas: { num: 2 } } });

    expect(
      fieldValue(endpointRuntimeFields(endpoint), "scheduler", endpoint),
    ).toBe("models.scheduler.unavailable");
  });
});
