import type {
  EndpointEngineRef,
  EndpointEngineVersionRef,
} from "@/domains/endpoint/types";

/** The engines by name: names in list order, each engine's versions and its own tasks. */
export function indexEndpointEngines(engines: EndpointEngineRef[] | undefined) {
  const engineNames: string[] = [];
  const engineVersions: Record<string, EndpointEngineVersionRef[]> = {};
  const engineTasks: Record<string, string[]> = {};
  for (const engine of engines || []) {
    const name = engine.metadata.name;
    engineNames.push(name);
    engineVersions[name] = engine.spec.versions;
    engineTasks[name] = engine.spec.supported_tasks ?? [];
  }
  return { engineNames, engineVersions, engineTasks };
}

/** The selected version entry of the selected engine, when both are known. */
export const selectedEngineVersion = (
  engineVersions: Record<string, EndpointEngineVersionRef[]>,
  engine: string,
  version: string,
) =>
  engine
    ? engineVersions[engine]?.find((v) => v.version === version)
    : undefined;

/** The tasks the selected engine supports: the version's own list when it has one, else the engine's. */
export const selectedEngineTasks = (
  engineTasks: Record<string, string[]>,
  engine: string,
  version: EndpointEngineVersionRef | undefined,
) =>
  engine
    ? version?.supported_tasks?.length
      ? version.supported_tasks
      : (engineTasks[engine] ?? [])
    : [];
