import { describe, expect, it } from "vitest";
import { emptyLogSinkFormValues, toLogSinkSpec } from "./log-sink-form";
import {
  buildTestConnectionRequest,
  readTestConnectionError,
} from "./test-connection";

const values = () => {
  const v = emptyLogSinkFormValues();
  v.metadata.name = "vl";
  v.spec.victorialogs.url = "https://vl:9428";
  v.spec.victorialogs.auth = {
    type: "bearer",
    username: "",
    password: "",
    token: "",
  };
  v.spec.buffer.max_size_gib = "2";
  return v;
};

describe("buildTestConnectionRequest", () => {
  it("create: sends only the spec the submit would save", () => {
    const v = values();
    v.spec.victorialogs.auth.token = "t";
    const request = buildTestConnectionRequest({ mode: "create", values: v });
    expect(request).toEqual({ spec: toLogSinkSpec(v) });
  });

  it("edit: sends id and the spec the submit would save", () => {
    const request = buildTestConnectionRequest({
      mode: "edit",
      id: 7,
      values: values(),
    });
    expect(request).toEqual({ id: 7, spec: toLogSinkSpec(values()) });
  });

  it("stored: sends only the id", () => {
    expect(buildTestConnectionRequest({ mode: "stored", id: 7 })).toEqual({
      id: 7,
    });
  });
});

describe("readTestConnectionError", () => {
  it("reads the error field from the response body", () => {
    const error = new Error(
      'Error: 400 Bad Request http://x/api/v1/log_sinks/test_connection {"error":"spec.victorialogs.url must be an http(s) URL with a host"}',
    );
    expect(readTestConnectionError(error, "fallback")).toBe(
      "spec.victorialogs.url must be an http(s) URL with a host",
    );
  });

  it("reads 403 bodies with extra fields", () => {
    const error = new Error(
      'Error: 403 Forbidden u {"error":"insufficient permissions","required":"log_sink:create"}',
    );
    expect(readTestConnectionError(error, "fallback")).toBe(
      "insufficient permissions",
    );
  });

  it("falls back to the message, then to the fallback", () => {
    expect(readTestConnectionError(new Error("network down"), "f")).toBe(
      "network down",
    );
    expect(readTestConnectionError({}, "f")).toBe("f");
  });
});
