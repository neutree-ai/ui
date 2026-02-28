import { useMemo } from "react";

const useEndpointResources = (
  resources?: {
    cpu?: number;
    memory?: number;
    gpu?: number;
    accelerator?: { type: string; product: string };
  },
  metadata?: Record<string, any>,
) => {
  return useMemo(() => {
    const hasRealData = metadata?.name && metadata.name !== "" && resources;

    if (hasRealData) {
      return {
        cpu: resources?.cpu || 0,
        memory: resources?.memory || 0,
        gpu: resources?.gpu || 0,
        accelerator: resources?.accelerator || null,
      };
    }

    return {
      cpu: 0,
      memory: 0,
      gpu: 0,
      accelerator: {},
    };
  }, [metadata?.name, resources]);
};

export default useEndpointResources;
