import { useMemo } from "react";
import type {
  EndpointEngineRef,
  EndpointEngineVersionRef,
} from "@/domains/endpoint/types";

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
      engineTasks[engine.metadata.name] = engine.spec.supported_tasks ?? [];
    }

    return { engineNames, engineVersions, engineTasks };
  }, [enginesData]);

  const engineVersion = useMemo(() => {
    return engineSpec.engine
      ? engineVersions[engineSpec.engine]?.find(
          (v) => v.version === engineSpec.version,
        )
      : undefined;
  }, [engineSpec.engine, engineSpec.version, engineVersions]);

  const engineTasksForVersion = useMemo(() => {
    return engineSpec.engine
      ? engineVersion?.supported_tasks?.length
        ? engineVersion.supported_tasks
        : (engineTasks[engineSpec.engine] ?? [])
      : [];
  }, [engineSpec.engine, engineTasks, engineVersion]);

  return {
    engineNames,
    engineVersions,
    engineTasks,
    engineTasksForVersion,
    engineValueSchema: engineVersion?.values_schema,
    engineVersion,
  };
}
