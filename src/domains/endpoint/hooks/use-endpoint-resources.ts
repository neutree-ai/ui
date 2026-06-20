import { useMemo } from "react";
import { normalizeEndpointResourcesForForm } from "@/domains/endpoint/lib/endpoint-form-helpers";

const useEndpointResources = (
  resources?: {
    cpu?: number | string | null;
    memory?: number | string | null;
    gpu?: number | string | null;
    accelerator?: { type: string; product: string } | null;
  },
  metadata?: Record<string, unknown>,
) => {
  return useMemo(() => {
    const hasRealData = metadata?.name && metadata.name !== "" && resources;

    if (hasRealData) {
      const normalizedResources = normalizeEndpointResourcesForForm(
        resources as Record<string, unknown>,
      );
      return {
        cpu: normalizedResources?.cpu || 0,
        memory: normalizedResources?.memory || 0,
        gpu: normalizedResources?.gpu || 0,
        accelerator: normalizedResources?.accelerator || null,
      };
    }

    return {
      cpu: 0,
      memory: 0,
      gpu: 0,
      accelerator: null,
    };
  }, [metadata?.name, resources]);
};

export default useEndpointResources;
