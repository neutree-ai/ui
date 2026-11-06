import type { CatalogOrigin } from "@/domains/endpoint/lib/catalog-origin";

export type EndpointModelDelivery =
  | "at-deploy-time"
  | "already-local"
  | "unknown"
  | null;

export type EndpointReviewCapacityMetric = {
  key: "cpu" | "memory" | "cards" | "vram" | "core";
  requested: number;
  available: number | null;
  total: number | null;
};

export type EndpointReviewContext = {
  catalogOrigin: CatalogOrigin | null;
  modelDelivery: EndpointModelDelivery;
  noVerifiedAccelerator: boolean;
  requiredVramGb: number | null;
  nodeCount: number | null;
  clusterCapacity: EndpointReviewCapacityMetric[] | null;
  clusterCapacityUnavailable: boolean;
};

/** The label and unit (translation keys) each capacity figure is shown with. A
 * figure without a unit, such as a core percentage, has an empty unit. */
export const CAPACITY_METRIC_LABELS: Record<
  EndpointReviewCapacityMetric["key"],
  { label: string; unit: string }
> = {
  cpu: {
    label: "common.fields.cpu",
    unit: "pages.vramCalculator.metrics.cores",
  },
  memory: { label: "common.fields.memory", unit: "endpoints.options.gib" },
  cards: {
    label: "endpoints.fields.physicalGpu",
    unit: "endpoints.fields.cards",
  },
  vram: { label: "clusters.fields.memoryUsage", unit: "endpoints.options.gib" },
  core: { label: "clusters.fields.coreUsage", unit: "" },
};

/** A capacity figure: whole numbers as is, fractions to one decimal. */
export const formatCapacityValue = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

/** Whether a replica set asks for more than the cluster has free. An unknown
 * availability is not reported as exceeded. */
export const capacityExceeded = (metric: EndpointReviewCapacityMetric) =>
  metric.available != null && metric.requested > metric.available;
