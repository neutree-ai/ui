import { useCustom } from "@refinedev/core";
import type { Endpoint } from "@/domains/endpoint/types";

type EndpointVgpuMonitorContext = {
  cluster: string;
  workspace: string;
  endpoint: string;
  namespace?: string | null;
  pod_regex?: string | null;
  pods?: Array<{
    name: string;
    status?: string;
    node?: string;
    containers?: string[];
  }> | null;
  resource?: {
    gpu_count?: number | null;
    core_percent?: number | null;
    memory_mib?: number | null;
  } | null;
};

export function useEndpointVgpuMonitorContext(
  endpoint: Endpoint | null | undefined,
  enabled: boolean,
) {
  const workspace = endpoint?.metadata.workspace;
  const name = endpoint?.metadata.name;

  return useCustom<EndpointVgpuMonitorContext>({
    url:
      workspace && name
        ? `/endpoints/${workspace}/${name}/vgpu-monitor-context`
        : "",
    method: "get",
    queryOptions: {
      enabled: enabled && Boolean(workspace && name),
    },
  });
}
