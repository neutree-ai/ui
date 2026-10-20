/**
 * `Created` is the steady phase for an engine — every healthy engine sits there,
 * so showing it adds noise on the engine surfaces. Only the exceptions are worth
 * the pixels. This is deliberately different from the model catalog card, which
 * always shows its phase.
 */
export function isExceptionalEnginePhase(
  phase: string | null | undefined,
): boolean {
  return Boolean(phase) && phase !== "Created";
}
