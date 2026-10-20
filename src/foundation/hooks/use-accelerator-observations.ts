import { useCustom } from "@refinedev/core";
import { useEffect, useState } from "react";
import type { AcceleratorSnapshot } from "@/foundation/lib/accelerator-observations";

export function useAcceleratorObservations(
  resource: "clusters" | "endpoints",
  workspace?: string | null,
  name?: string | null,
) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const query = useCustom<AcceleratorSnapshot>({
    url: `/${resource}/${encodeURIComponent(workspace ?? "")}/${encodeURIComponent(name ?? "")}/accelerator-observations`,
    method: "get",
    queryOptions: {
      enabled: !!workspace && !!name,
      refetchInterval: 15000,
      retry: false,
    },
  });
  const samples = query.error
    ? []
    : (query.data?.data.samples ?? []).filter(
        (s) => now / 1000 - s.observed_at <= 90,
      );
  return {
    samples,
    status: query.error
      ? "unavailable"
      : query.isLoading
        ? "loading"
        : query.data?.data.status === "not_configured"
          ? "not_configured"
          : samples.length
            ? "ok"
            : "no_data",
  };
}
