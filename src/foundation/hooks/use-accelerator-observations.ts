import { useCustom } from "@refinedev/core";
import {
  type AcceleratorSnapshot,
  observationStatus,
} from "@/foundation/lib/accelerator-observations";

export function useAcceleratorObservations(
  resource: "clusters" | "endpoints",
  workspace?: string | null,
  name?: string | null,
  enabled = true,
) {
  const query = useCustom<AcceleratorSnapshot>({
    url: `/${resource}/${encodeURIComponent(workspace ?? "")}/${encodeURIComponent(name ?? "")}/accelerator-observations`,
    method: "get",
    queryOptions: {
      enabled: Boolean(workspace && name && enabled),
      refetchInterval: 15000,
      retry: false,
    },
  });
  // A disabled query keeps its last cached result; it is not shown.
  if (!enabled)
    return { samples: [], status: "no_data" as const, refetch: () => {} };
  const samples = query.error ? [] : (query.data?.data.samples ?? []);
  return {
    samples,
    status: observationStatus(
      Boolean(query.error),
      query.isLoading,
      query.data?.data.status,
      samples.length > 0,
    ),
    refetch: () => {
      void query.refetch();
    },
  };
}
