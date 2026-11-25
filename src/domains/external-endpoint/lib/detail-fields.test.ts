import { describe, expect, it } from "vitest";
import {
  makeExternalEndpoint,
  makeRoute,
  makeUpstream,
} from "@/domains/external-endpoint/testing/fixtures";
import { fieldValue } from "@/foundation/testing/detail-fields";
import { externalEndpointHeaderFields as fields } from "./detail-fields";

describe("externalEndpointHeaderFields", () => {
  it.each([
    { upstreams: [], shown: null },
    {
      upstreams: [makeUpstream(), makeUpstream({ endpoint_ref: "chat" })],
      shown: "external_endpoints.options.upstreamTypeMixed",
    },
  ])("names the upstream type $shown", ({ upstreams, shown }) => {
    const endpoint = makeExternalEndpoint({ upstreams });

    expect(fieldValue(fields, "type", endpoint)).toBe(shown);
  });

  it("counts the exposed models", () => {
    const endpoint = makeExternalEndpoint({
      model_routes: [makeRoute(), makeRoute({ model: "embed" })],
    });

    expect(fieldValue(fields, "models", endpoint)).toBe(2);
  });
});
