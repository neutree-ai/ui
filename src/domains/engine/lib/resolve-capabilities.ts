import type { EngineVersion, PlaygroundMode } from "@/domains/engine/types";

/**
 * Playground state resolved for a specific endpoint, with the
 * undeclared-means-legacy fallback already applied.
 */
type ResolvedPlayground = {
  /** Whether the Playground tab should be offered at all. */
  enabled: boolean;
  /**
   * Which Playground component to render. Null only when `enabled` is false.
   */
  mode: PlaygroundMode | null;
};

/**
 * Maps an endpoint's model task to the interaction surface the console used
 * before engines could declare capabilities: embedding and rerank tasks each
 * had their own Playground, everything else fell through to chat.
 */
function modeFromTask(task: string | undefined): PlaygroundMode {
  switch (task) {
    case "text-embedding":
      return "embedding";
    case "text-rerank":
      return "rerank";
    default:
      return "chat";
  }
}

/**
 * Resolves whether to show the Playground for an endpoint, and which one.
 *
 * The fallback rules mirror `EngineVersion.ResolvePlayground` on the server
 * (api/v1/engine_types.go). They matter more than the happy path: an engine
 * version with no declaration — every engine registered before the capability
 * protocol, including externally registered ones in already-deployed
 * environments — must behave exactly as it did before, which means the tab
 * stays visible and the surface comes from the model task.
 *
 * @param engineVersion the endpoint's engine version, or undefined while the
 *   engine query is still loading or the version is no longer registered
 * @param task the endpoint's `spec.model.task`
 */
export function resolvePlayground(
  engineVersion: EngineVersion | undefined,
  task: string | undefined,
): ResolvedPlayground {
  const declared = engineVersion?.capabilities?.playground;

  // Undeclared, or the engine version could not be resolved at all: keep the
  // pre-protocol behaviour rather than hiding a Playground that works today.
  if (!declared) {
    return { enabled: true, mode: modeFromTask(task) };
  }

  if (!declared.enabled) {
    return { enabled: false, mode: null };
  }

  const modes = declared.modes ?? [];

  // Enabled without narrowing the surface down: same as undeclared.
  if (modes.length === 0) {
    return { enabled: true, mode: modeFromTask(task) };
  }

  const preferred = modeFromTask(task);

  if (modes.includes(preferred)) {
    return { enabled: true, mode: preferred };
  }

  // The engine declares surfaces, but not the one this task implies. Trust the
  // declaration over the task — that is the whole point of the protocol — and
  // render the first surface it does declare.
  return { enabled: true, mode: modes[0] };
}
