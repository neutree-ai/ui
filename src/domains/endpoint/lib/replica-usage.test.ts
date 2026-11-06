import { describe, expect, it } from "vitest";
import type {
  AcceleratorSample,
  GpuAllocation,
} from "@/foundation/lib/accelerator-observations";
import { makeAcceleratorSample } from "@/foundation/testing/resource-builders";
import { replicaGroupUsage } from "./replica-usage";

const allocation = (uuid: string): GpuAllocation => ({
  endpoint: "ep",
  workspace: "default",
  model: "m",
  node: "node-a",
  uuid,
  replica: "ep-0",
  instance: "ep",
  memoryMiB: 8192,
});

const samplesFor = (
  uuid: string,
  memoryGiB: number | null,
  utilization: number | null,
): AcceleratorSample[] => {
  const labels = {
    node: "node-a",
    accelerator_uuid: uuid,
    endpoint: "ep",
    instance_id: "ep",
    replica: "ep-0",
  };
  return [
    ...(memoryGiB == null
      ? []
      : [
          makeAcceleratorSample(
            "neutree_endpoint_replica_accelerator_memory_used_bytes",
            memoryGiB * 1024 ** 3,
            labels,
          ),
        ]),
    ...(utilization == null
      ? []
      : [
          makeAcceleratorSample(
            "neutree_endpoint_replica_accelerator_utilization_ratio",
            utilization,
            labels,
          ),
        ]),
  ];
};

describe("replicaGroupUsage", () => {
  it.each([
    {
      name: "every device measured",
      readings: [
        [10, 0.5],
        [6, 0.25],
      ],
      expected: {
        actualMiB: 16384,
        averageUtilization: 37.5,
        peakUtilization: 50,
      },
    },
    {
      name: "one device missing memory",
      readings: [
        [10, 0.5],
        [null, 0.25],
      ],
      expected: {
        actualMiB: null,
        averageUtilization: 37.5,
        peakUtilization: 50,
      },
    },
    {
      name: "one device missing utilization",
      readings: [
        [10, 0.5],
        [6, null],
      ],
      expected: {
        actualMiB: 16384,
        averageUtilization: null,
        peakUtilization: null,
      },
    },
    {
      name: "no devices",
      readings: [],
      expected: {
        actualMiB: null,
        averageUtilization: null,
        peakUtilization: null,
      },
    },
  ])("$name", ({ readings, expected }) => {
    const uuids = readings.map((_, index) => `GPU-${index}`);
    expect(
      replicaGroupUsage(
        uuids.map(allocation),
        readings.flatMap(([memory, util], index) =>
          samplesFor(uuids[index], memory, util),
        ),
      ),
    ).toEqual(expected);
  });
});
