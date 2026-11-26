import { useMemo } from "react";
import {
  indexEndpointEngines,
  selectedEngineTasks,
  selectedEngineVersion,
} from "@/domains/endpoint/lib/endpoint-deploy-engine";
import type { EndpointEngineRef } from "@/domains/endpoint/types";

interface UseEndpointEngineOptionsProps {
  enginesData: EndpointEngineRef[] | undefined;
  engineSpec: { engine: string; version: string };
}

export function useEndpointEngineOptions({
  enginesData,
  engineSpec,
}: UseEndpointEngineOptionsProps) {
  const { engineNames, engineVersions, engineTasks } = useMemo(
    () => indexEndpointEngines(enginesData),
    [enginesData],
  );

  const engineVersion = useMemo(
    () =>
      selectedEngineVersion(
        engineVersions,
        engineSpec.engine,
        engineSpec.version,
      ),
    [engineSpec.engine, engineSpec.version, engineVersions],
  );

  const engineTasksForVersion = useMemo(
    () => selectedEngineTasks(engineTasks, engineSpec.engine, engineVersion),
    [engineSpec.engine, engineTasks, engineVersion],
  );

  return {
    engineNames,
    engineVersions,
    engineTasks,
    engineTasksForVersion,
    engineValueSchema: engineVersion?.values_schema,
    engineVersion,
  };
}
