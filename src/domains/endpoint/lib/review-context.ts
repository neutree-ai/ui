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
