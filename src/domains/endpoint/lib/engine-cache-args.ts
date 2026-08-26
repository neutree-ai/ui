/**
 * The two engine arguments that decide how much KV cache a deployment will
 * actually need: how long a context it opens, and how many sequences it runs at
 * once.
 *
 * A checkpoint states what it *can* do — `max_position_embeddings` is a
 * theoretical ceiling — while the engine args state what this deployment *will*
 * do. The two are routinely far apart: Qwen3.6-27B states 262144, and a recipe
 * that opens a 32768-token context needs an eighth of the cache that ceiling
 * implies. Someone filling in a deployment form is asking about the deployment.
 *
 * These are read per engine, not per model. The flags mean the same thing
 * everywhere but are not spelled the same way — vLLM's `--max-model-len` and
 * `--max-num-seqs` are SGLang's `--context-length` and `--max-running-requests`
 * — so a single name list would silently read nothing on one of them and there
 * is no way to tell the spellings apart from the value. An engine this module
 * has no mapping for reads as "not stated", which falls back to the checkpoint
 * rather than guessing that some other engine's spelling applies.
 */

/** What this deployment's engine args say about the cache it will need. */
export type EngineCacheArgs = {
  /** Tokens of context the engine is configured to open, or null if unstated. */
  maxModelLen: number | null;
  /** Sequences the engine is configured to run at once, or null if unstated. */
  maxNumSeqs: number | null;
};

export const NO_ENGINE_CACHE_ARGS: EngineCacheArgs = {
  maxModelLen: null,
  maxNumSeqs: null,
};

/**
 * The flag each engine spells these two quantities with, by the engine
 * identifier the endpoint spec carries.
 *
 * Adding an engine means adding a row here. That is deliberate: a new engine
 * whose flags nobody has checked reads as "not stated" and the panel falls back
 * to the checkpoint, which is a visibly conservative answer, rather than
 * matching a name that happens to look familiar and reporting a number off the
 * wrong flag.
 */
const ENGINE_CACHE_ARG_NAMES: Record<
  string,
  { context: string; concurrency: string }
> = {
  vllm: { context: "max_model_len", concurrency: "max_num_seqs" },
  sglang: { context: "context_length", concurrency: "max_running_requests" },
};

/**
 * A positive whole number, or null. engine_args is a free-form map: a recipe's
 * input feature coerces `${value}` to a number, but a hand-written arg can
 * arrive as a string, and neither an unparseable value nor a zero is a context
 * length.
 */
function positiveInteger(raw: unknown): number | null {
  const value = typeof raw === "string" ? Number(raw.trim()) : raw;

  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Number.isInteger(value) ? value : null;
}

/**
 * Reads one flag, accepting both the underscore form an engine_args map
 * normally carries and the dashed form the command line uses. Those are two
 * spellings of one flag rather than two flags, so accepting both is not
 * widening the mapping.
 */
function readArg(
  engineArgs: Record<string, unknown>,
  name: string,
): number | null {
  const dashed = name.replaceAll("_", "-");

  return (
    positiveInteger(engineArgs[name]) ?? positiveInteger(engineArgs[dashed])
  );
}

/**
 * What the engine args of the deployment being filled in state about its cache.
 *
 * Everything is optional on the way in, because every one of these is absent at
 * some point in the form's life: no engine chosen yet, no catalog applied, a
 * variant that overrides neither flag.
 */
export function readEngineCacheArgs(
  engine: string | null | undefined,
  engineArgs: Record<string, unknown> | null | undefined,
): EngineCacheArgs {
  const names = engine ? ENGINE_CACHE_ARG_NAMES[engine] : undefined;

  if (!names || !engineArgs) {
    return NO_ENGINE_CACHE_ARGS;
  }

  return {
    maxModelLen: readArg(engineArgs, names.context),
    maxNumSeqs: readArg(engineArgs, names.concurrency),
  };
}
