import type {
  EndpointEngineRef,
  EndpointEngineVersionRef,
} from "@/domains/endpoint/types";
import { useMemo } from "react";

interface UseEndpointEngineOptionsProps {
  enginesData: EndpointEngineRef[] | undefined;
  engineSpec: { engine: string; version: string };
}

export function useEndpointEngineOptions({
  enginesData,
  engineSpec,
}: UseEndpointEngineOptionsProps) {
  const { engineNames, engineVersions, engineTasks } = useMemo(() => {
    const engineNames: string[] = [];
    const engineVersions: Record<string, EndpointEngineVersionRef[]> = {};
    const engineTasks: Record<string, string[]> = {};

    for (const engine of enginesData || []) {
      engineNames.push(engine.metadata.name);
      engineVersions[engine.metadata.name] = engine.spec.versions;
      engineTasks[engine.metadata.name] = engine.spec.supported_tasks;
    }

    return { engineNames, engineVersions, engineTasks };
  }, [enginesData]);

  const engineValueSchema = useMemo(() => {
    return engineSpec.engine
      ? engineVersions[engineSpec.engine]?.find(
          (v) => v.version === engineSpec.version,
        )?.values_schema
      : undefined;
  }, [engineSpec.engine, engineSpec.version, engineVersions]);

  return { engineNames, engineVersions, engineTasks, engineValueSchema };
}
