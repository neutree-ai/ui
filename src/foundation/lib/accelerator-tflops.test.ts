import { describe, expect, it } from "vitest";
import type { ClusterResourceInfo } from "@/foundation/types/resource-types";
import type {
  AcceleratorSample,
  ObservedGpu,
} from "./accelerator-observations";
import {
  flopsHistory,
  flopsTotals,
  formatFlops,
  isValidTflopsDraft,
  mergeTflopsDraft,
  observedDevices,
  parseTflops,
  peakTflops,
  productPeakTflops,
} from "./accelerator-tflops";

const makeDevice = (over: Partial<ObservedGpu> = {}): ObservedGpu => ({
  node: "n",
  uuid: "g",
  index: 0,
  product: "T4",
  peakFP16TFLOPS: 65,
  healthy: true,
  totalMiB: null,
  allocatedMiB: null,
  ...over,
});

const utilization = (
  uuid: string,
  value: number,
  observed_at = 1,
  product = "T4",
): AcceleratorSample => ({
  metric: "neutree_accelerator_utilization_ratio",
  labels: { node: "n", accelerator_uuid: uuid, product },
  value,
  observed_at,
});

const makeInfo = (
  metadata: Record<string, Record<string, number>>,
): ClusterResourceInfo =>
  ({
    accelerator_metadata: Object.fromEntries(
      Object.entries(metadata).map(([type, products]) => [
        type,
        {
          products: Object.fromEntries(
            Object.entries(products).map(([product, peak]) => [
              product,
              { peak_fp16_tflops: peak },
            ]),
          ),
        },
      ]),
    ),
    node_resources: {
      n: { devices: [{ uuid: "g", product: "T4", health: true }] },
    },
  }) as unknown as ClusterResourceInfo;

describe("flopsTotals", () => {
  it("sums known healthy cards, skipping unknown products, unmeasured and unhealthy cards", () => {
    const devices = [
      makeDevice({ uuid: "unknown", product: "unknown", peakFP16TFLOPS: null }),
      makeDevice({ uuid: "unmeasured" }),
      makeDevice(),
      makeDevice({ uuid: "bad", healthy: false }),
    ];
    expect(
      flopsTotals(devices, [utilization("g", 0.5), utilization("bad", 1)], {}),
    ).toEqual({ total: 130, used: 32.5 });
  });

  it.each([
    { name: "zero usage", ratio: 0, used: 0 },
    { name: "NaN", ratio: NaN, used: null },
    { name: "Infinity", ratio: Infinity, used: null },
    { name: "below 0", ratio: -0.1, used: null },
    { name: "above 1", ratio: 1.1, used: null },
  ])("treats a $name utilization as used $used", ({ ratio, used }) => {
    expect(flopsTotals([makeDevice()], [utilization("g", ratio)], {})).toEqual({
      total: 65,
      used,
    });
  });

  it.each([
    {
      name: "only unknown cards",
      devices: [makeDevice({ product: "unknown", peakFP16TFLOPS: null })],
      totals: { total: null, used: null },
    },
    { name: "no cards", devices: [], totals: { total: 0, used: 0 } },
  ])("reports $name as $totals", ({ devices, totals }) => {
    expect(flopsTotals(devices, [utilization("g", 0.5)], {})).toEqual(totals);
  });
});

describe("flopsHistory", () => {
  const info = makeInfo({ nvidia_gpu: { T4: 65 } });

  it("values each point by its own cards and keeps a point with no known card unknown", () => {
    const devices = [makeDevice()];
    expect(
      flopsHistory(
        [
          utilization("unknown", 0.8, 2, "unknown"),
          utilization("g", 0.5, 1),
          utilization("unknown", 0.8, 1, "unknown"),
          utilization("g", 0, 3),
          utilization("unknown", 1, 4, "unknown"),
        ],
        devices,
        {},
        info,
      ),
    ).toEqual([
      { time: 1, value: 32.5 },
      { time: 2, value: null },
      { time: 3, value: 0 },
      { time: 4, value: null },
    ]);
  });

  it("counts a duplicate scrape of one card once", () => {
    expect(
      flopsHistory(
        [utilization("g", 0.5), utilization("g", 0.5)],
        [makeDevice()],
        {},
        info,
      ),
    ).toEqual([{ time: 1, value: 32.5 }]);
  });

  it("values a card no longer in the cluster by its sampled product", () => {
    expect(
      flopsHistory([utilization("gone", 1, 1, "T4")], [], {}, info),
    ).toEqual([{ time: 1, value: 65 }]);
  });
});

describe("peakTflops", () => {
  it.each<{
    name: string;
    spec?: number;
    overrides: Record<string, number>;
    peak: number | null;
  }>([
    { name: "no specification", spec: undefined, overrides: {}, peak: null },
    { name: "a specification", spec: 312, overrides: {}, peak: 312 },
    { name: "a calibration", spec: 65, overrides: { T4: 70 }, peak: 70 },
    { name: "a NaN specification", spec: NaN, overrides: {}, peak: null },
    { name: "an infinite spec", spec: Infinity, overrides: {}, peak: null },
    { name: "a zero specification", spec: 0, overrides: {}, peak: null },
    { name: "a negative spec", spec: -1, overrides: {}, peak: null },
  ])("uses $name -> $peak", ({ spec, overrides, peak }) => {
    expect(peakTflops("T4", overrides, spec)).toBe(peak);
  });
});

describe("productPeakTflops", () => {
  it.each<{
    name: string;
    product: string;
    meta: Record<string, Record<string, number>>;
    peak: number | null;
  }>([
    { name: "exact product", product: "T4", meta: { a: { T4: 65 } }, peak: 65 },
    {
      name: "no fuzzy name match",
      product: "Tesla-T4",
      meta: { a: { T4: 65 } },
      peak: null,
    },
    {
      name: "conflicting types",
      product: "T4",
      meta: { a: { T4: 65 }, b: { T4: 70 } },
      peak: null,
    },
  ])("$name -> $peak", ({ product, meta, peak }) => {
    expect(productPeakTflops(makeInfo(meta), product)).toBe(peak);
  });

  it("is attached to each observed device", () => {
    expect(observedDevices(makeInfo({ a: { T4: 65 } }))[0].peakFP16TFLOPS).toBe(
      65,
    );
  });
});

describe("parseTflops", () => {
  it.each([
    {
      raw: '{"T4":0,"H100":-2,"A10":"125","L4":121}',
      parsed: { L4: 121 },
    },
    { raw: "broken", parsed: {} },
    { raw: "[1]", parsed: {} },
    { raw: undefined, parsed: {} },
  ])("$raw -> $parsed", ({ raw, parsed }) => {
    expect(parseTflops(raw)).toEqual(parsed);
  });
});

describe("calibration draft", () => {
  it.each([
    { value: "", valid: true },
    { value: "  ", valid: true },
    { value: "70", valid: true },
    { value: "0", valid: false },
    { value: "-1", valid: false },
    { value: "abc", valid: false },
  ])("'$value' is valid: $valid", ({ value, valid }) => {
    expect(isValidTflopsDraft({ T4: value })).toBe(valid);
  });

  it("sets, clears, and keeps entries for products not in the dialog", () => {
    expect(
      mergeTflopsDraft(
        { T4: 70, A10: 125, H100: 900 },
        { T4: "75", A10: " " },
        ["T4", "A10"],
      ),
    ).toEqual({ T4: 75, H100: 900 });
  });
});

it.each([
  { value: null, text: "—" },
  { value: 65, text: "65.00 TFLOPS" },
  { value: 1500, text: "1.50 PFLOPS" },
])("formatFlops($value) -> $text", ({ value, text }) => {
  expect(formatFlops(value)).toBe(text);
});
