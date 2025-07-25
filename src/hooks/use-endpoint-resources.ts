import { useEffect, useState } from "react";

const useEndpointResources = (
  resources: {
    cpu?: number;
    memory?: number;
    gpu?: number;
    npu?: number;
    accelerator?: Record<string, number>;
  } | null,
  metadata: {
    name?: string;
  } | null,
  action: "create" | "edit"
) => {
  const [currentUsage, setCurrentUsage] = useState<{
    cpu: number;
    memory: number;
    gpu: number;
    npu: number;
    accelerator: Record<string, number>;
  } | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isInitialized) return;

    if (action === "create") {
      const usage = {
        cpu: resources?.cpu || 0,
        memory: resources?.memory || 0,
        gpu: resources?.gpu || 0,
        npu: resources?.accelerator?.NPU || 0,
        accelerator: resources?.accelerator || { "-": 0 }
      };
      setCurrentUsage(usage);
      setIsInitialized(true);
      return;
    }
    
    // For edit mode, check if we have real data
    const hasRealData = metadata?.name && 
                       metadata.name !== "" &&
                       resources;

    if (hasRealData) {
      const usage = {
        cpu: resources?.cpu || 0,
        memory: resources?.memory || 0,
        gpu: resources?.gpu || 0,
        npu: resources?.accelerator?.NPU || 0,
        accelerator: resources?.accelerator || { "-": 0 }
      };
      setCurrentUsage(usage);
      setIsInitialized(true);
    }
  }, [
    action, 
    metadata?.name,
    resources,
    isInitialized
  ]);

  return currentUsage || {
    cpu: 0,
    memory: 0,
    gpu: 0,
    npu: 0,
    accelerator: {}
  };
};

export default useEndpointResources;