import { useCustom } from "@refinedev/core";
import type { AcceleratorSnapshot } from "@/foundation/lib/accelerator-observations";

export function useAcceleratorObservations(
  resource: "clusters" | "endpoints",
  workspace?: string | null,
  name?: string | null,
) {
  const query = useCustom<AcceleratorSnapshot>({
    url: `/${resource}/${encodeURIComponent(workspace ?? "")}/${encodeURIComponent(name ?? "")}/accelerator-observations`,
    method: "get",
    queryOptions: {
      enabled: !!workspace && !!name,
      refetchInterval: 15000,
      retry: false,
    },
  });
  const samples = query.error ? [] : (query.data?.data.samples ?? []);
  return {
    samples,
    status: observationStatus(
      Boolean(query.error),
      query.isLoading,
      query.data?.data.status,
      samples.length,
    ),
  };
}

function observationStatus(
  failed: boolean,
  loading: boolean,
  reported: AcceleratorSnapshot["status"] | undefined,
  sampleCount: number,
) {
  if (failed) return "unavailable";
  if (loading) return "loading";
  if (reported === "not_configured") return "not_configured";
  return sampleCount ? "ok" : "no_data";
}
