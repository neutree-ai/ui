/**
 * Engines whose model, if they have one at all, is baked into their image. The
 * Flex engine runs an arbitrary HTTP workload — it may be serving a model, or an
 * OCR service, or nothing model-shaped at all — and Neutree neither fetches nor
 * names whatever it serves.
 */
const ENGINES_WITHOUT_MODEL_SPEC = ["flex"];

/**
 * engineNeedsModelSpec reports whether an endpoint on this engine has a
 * `spec.model` worth filling in, and therefore whether the form should ask.
 *
 * Phrased as a need rather than as a fact about the engine: one that brings its
 * own workload may serve no model at all, so "it provides the model" would
 * assert more than is true. What is true is that Neutree manages no model for
 * it.
 *
 * Recognised by engine name. The server answers the neighbouring question —
 * "does Neutree download this model?" — by excluding the three built-in
 * downloader engines, and copying that inverted rule here would drop the model
 * fields for every newly registered external engine, silently, with no way for
 * the user to supply what it does need. Naming the engines instead means an
 * unrecognised one keeps today's form: a field too many, never a field too few.
 *
 * The two rules are therefore deliberately different and both fail safe — do not
 * "align" them. The convergence is an engine capability declaration both sides
 * read, which is a separate change; it lives here rather than under the engine
 * domain because an L2 domain may not import from another one.
 */
export function engineNeedsModelSpec(engineName?: string | null): boolean {
  return !engineName || !ENGINES_WITHOUT_MODEL_SPEC.includes(engineName);
}
