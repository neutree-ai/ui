import { describe, expect, it } from "vitest";
import {
  formatBandwidth,
  formatLatency,
  formatPercent,
  formatTokenRate,
} from "./performance-format";

const notMeasured = [null, undefined, NaN, Infinity, -1];

describe.each([
  { name: "formatLatency", format: formatLatency },
  { name: "formatTokenRate", format: formatTokenRate },
  { name: "formatPercent", format: formatPercent },
  { name: "formatBandwidth", format: formatBandwidth },
])("$name", ({ format }) => {
  it.each(notMeasured)("renders %s as a dash", (value) => {
    expect(format(value)).toBe("—");
  });
});

it.each([
  [0, "0 ms"],
  [0.0042, "4.2 ms"],
  [0.185, "185 ms"],
  [1.5, "1.50 s"],
])("formatLatency(%s) -> %s", (seconds, text) => {
  expect(formatLatency(seconds)).toBe(text);
});

it.each([
  [0, "0 tok/s"],
  [85.25, "85.25 tok/s"],
  [12.5, "12.5 tok/s"],
  [42, "42 tok/s"],
  [505.75, "505.8 tok/s"],
])("formatTokenRate(%s) -> %s", (rate, text) => {
  expect(formatTokenRate(rate)).toBe(text);
});

it.each([
  [0.35, "35.0%"],
  [1.2, "100.0%"],
])("formatPercent(%s) -> %s", (ratio, text) => {
  expect(formatPercent(ratio)).toBe(text);
});

it.each([
  [0, "0 B/s"],
  [512, "512 B/s"],
  [1536, "1.5 KiB/s"],
  [512 * 1024 ** 2, "512.0 MiB/s"],
  [2 * 1024 ** 3, "2.00 GiB/s"],
])("formatBandwidth(%s) -> %s", (bytes, text) => {
  expect(formatBandwidth(bytes)).toBe(text);
});
