import type { CrudFilter } from "@refinedev/core";
import type { Cluster } from "../types";

/** Endpoints placed on this cluster: their `spec.cluster` holds its name. */
export const clusterEndpointsFilter = (
  cluster: Pick<Cluster, "metadata">,
): CrudFilter[] => [
  {
    field: "spec->cluster",
    operator: "eq",
    value: JSON.stringify(cluster.metadata.name),
  },
];
