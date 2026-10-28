import { describe, expect, it } from "vitest";
import {
  isIpDuplicated,
  validateNodeIps,
  validateSingleIp,
} from "./validate-node-ips";

describe("isIpDuplicated", () => {
  it.each([
    {
      ip: "10.0.0.1",
      workers: ["10.0.0.1", "10.0.0.2"],
      head: "10.0.0.3",
      dup: true,
    },
    { ip: "10.0.0.1", workers: ["10.0.0.2"], head: "10.0.0.1", dup: true },
    {
      ip: "10.0.0.3",
      workers: ["10.0.0.1", "10.0.0.2"],
      head: "10.0.0.4",
      dup: false,
    },
    { ip: "10.0.0.1", workers: [], head: "10.0.0.2", dup: false },
  ])(
    "$ip vs head $head, workers $workers -> $dup",
    ({ ip, workers, head, dup }) => {
      expect(isIpDuplicated(ip, workers, head)).toBe(dup);
    },
  );
});

describe("validateNodeIps", () => {
  it.each([
    [{ head_ip: "10.0.0.1", worker_ips: ["10.0.0.2"] }, null],
    [{ head_ip: "192.168.1.1", worker_ips: [] }, null],
    [{ head_ip: "", worker_ips: [] }, "required"],
    [undefined, "required"],
    [{ head_ip: "999.999.999.999", worker_ips: [] }, "invalidIP"],
    [{ head_ip: "10.0.0.1", worker_ips: ["10.0.0.1"] }, "duplicated"],
  ])("%j -> %s", (value, error) => {
    expect(validateNodeIps(value)).toBe(error);
  });
});

describe("validateSingleIp", () => {
  it.each([
    {
      ip: "10.0.0.3",
      workers: ["10.0.0.1"],
      head: "10.0.0.2",
      required: false,
      error: null,
    },
    { ip: "", workers: [], head: "10.0.0.1", required: false, error: null },
    {
      ip: "",
      workers: [],
      head: "10.0.0.1",
      required: true,
      error: "required",
    },
    {
      ip: "abc",
      workers: [],
      head: "10.0.0.1",
      required: false,
      error: "invalidIP",
    },
    {
      ip: "10.0.0.1",
      workers: ["10.0.0.1"],
      head: "10.0.0.2",
      required: false,
      error: "duplicated",
    },
    {
      ip: "10.0.0.1",
      workers: [],
      head: "10.0.0.1",
      required: false,
      error: "duplicated",
    },
  ])(
    "'$ip' (required: $required) -> $error",
    ({ ip, workers, head, required, error }) => {
      expect(validateSingleIp(ip, workers, head, required)).toBe(error);
    },
  );
});
