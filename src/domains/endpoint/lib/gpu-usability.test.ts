import { describe, expect, it } from "vitest";
import { buildGpuDeviceResourceRows } from "@/foundation/lib/gpu-device-resources";
import {
  FULL_T4,
  makeGpuDevice,
  makeNodeResources,
  makeResourceInfo,
} from "@/foundation/testing/resource-builders";
import type { DeviceResource } from "@/foundation/types/resource-types";
import { makeResourceRequest } from "../testing/builders";
import {
  type EndpointResourceRequestContext,
  isDeviceUsableForRequest,
} from "./gpu-usability";

const HALF_T4 = { memory_mib: 7680, core_units: 50 };

const FULL = makeResourceRequest("full", { gpuPerReplica: 1 });
const FRACTIONAL = makeResourceRequest("fractional", { gpuPerReplica: 0.75 });
const VGPU = makeResourceRequest("vgpu", {
  memoryMiBPerCard: 4096,
  coreUnitsPerCard: 50,
});

// One node holding `device`; the row is what the panel builds for Tesla-T4.
const usable = (
  device: DeviceResource,
  req: EndpointResourceRequestContext | undefined,
  {
    node = { cpu: 24, memory: 96 },
    scheduling,
  }: {
    node?: { cpu: number; memory: number };
    scheduling?: DeviceResource;
  } = {},
) => {
  const status = makeNodeResources({
    available: makeResourceInfo(node.cpu, node.memory),
    devices: [device],
  });
  const [row] = buildGpuDeviceResourceRows(
    { "node-a": status },
    { type: "nvidia_gpu", product: "Tesla-T4" },
  );
  const schedulingStatus = scheduling
    ? { ...status, devices: [scheduling] }
    : status;
  return isDeviceUsableForRequest(row, req, schedulingStatus);
};

describe("isDeviceUsableForRequest", () => {
  it.each([
    {
      name: "a free card without a request",
      available: FULL_T4,
      expected: true,
    },
    {
      name: "a partial card without a request",
      available: HALF_T4,
      expected: false,
    },
  ])("$name -> $expected", ({ available, expected }) => {
    expect(usable(makeGpuDevice("gpu", available), undefined)).toBe(expected);
  });

  it.each([
    { name: "an unhealthy card", overrides: { health: false } },
    { name: "another product", overrides: { product: "H100" } },
  ])("rejects $name for any request", ({ overrides }) => {
    expect(usable(makeGpuDevice("gpu", FULL_T4, overrides), FULL)).toBe(false);
  });

  it.each([
    {
      name: "too little node CPU",
      node: { cpu: 1, memory: 96 },
      req: makeResourceRequest("vgpu", { cpuPerReplica: 2 }),
    },
    {
      name: "too little node memory",
      node: { cpu: 24, memory: 4 },
      req: makeResourceRequest("vgpu", { memoryPerReplica: 8 }),
    },
  ])("rejects a free card on a node with $name", ({ node, req }) => {
    expect(usable(makeGpuDevice("gpu"), req, { node })).toBe(false);
  });

  it.each([
    { mode: "full", req: FULL, available: FULL_T4, expected: true },
    { mode: "full", req: FULL, available: HALF_T4, expected: false },
    {
      mode: "fractional 0.75",
      req: FRACTIONAL,
      available: { memory_mib: 1, core_units: 75 },
      expected: true,
    },
    {
      mode: "fractional 0.75",
      req: FRACTIONAL,
      available: HALF_T4,
      expected: false,
    },
    { mode: "vgpu 4 GiB/50", req: VGPU, available: HALF_T4, expected: true },
    {
      mode: "vgpu 4 GiB/50",
      req: VGPU,
      available: { memory_mib: 2048, core_units: 50 },
      expected: false,
    },
    {
      mode: "vgpu 4 GiB/50",
      req: VGPU,
      available: { memory_mib: 7680, core_units: 40 },
      expected: false,
    },
  ])(
    "$mode on $available.memory_mib MiB/$available.core_units cores -> $expected",
    ({ req, available, expected }) => {
      expect(usable(makeGpuDevice("gpu", available), req)).toBe(expected);
    },
  );

  it.each([
    { mode: "full", req: FULL },
    { mode: "fractional", req: FRACTIONAL },
  ])("judges $mode by the scheduling view of the device", ({ req }) => {
    expect(
      usable(makeGpuDevice("gpu", HALF_T4), req, {
        scheduling: makeGpuDevice("gpu"),
      }),
    ).toBe(true);
  });
});
