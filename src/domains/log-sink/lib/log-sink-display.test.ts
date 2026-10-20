import { describe, expect, it } from "vitest";
import { formatLogSinkDestination } from "./log-sink-display";

describe("formatLogSinkDestination", () => {
  it("shows the victorialogs URL", () => {
    expect(
      formatLogSinkDestination({
        type: "victorialogs",
        victorialogs: { url: "https://vl:9428" },
      }),
    ).toEqual({ primary: "https://vl:9428" });
  });

  it("shows the s3 bucket with the default prefix and no host for AWS", () => {
    expect(
      formatLogSinkDestination({
        type: "s3",
        s3: { region: "us-east-1", bucket: "traces", auth: {} },
      }),
    ).toEqual({
      primary: "s3://traces/neutree/%Y/%m/%d/",
      secondary: undefined,
    });
  });

  it("shows the s3 prefix and the endpoint host", () => {
    expect(
      formatLogSinkDestination({
        type: "s3",
        s3: {
          endpoint: "http://demo-s3:9000",
          region: "us-east-1",
          bucket: "traces",
          key_prefix: "logs/",
        },
      }),
    ).toEqual({ primary: "s3://traces/logs/", secondary: "demo-s3:9000" });
  });
});
