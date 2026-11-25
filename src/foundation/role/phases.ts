import { STATUS_TONE, type StatusTone } from "@/foundation/role/status-tone";

type Options = {
  /** Tone of a phase the table does not list; unset leaves it untoned. */
  fallback?: StatusTone;
  /** The locale keys are the lowercased phase. */
  lowercase?: boolean;
};

export type Phases = {
  tones: Record<string, StatusTone>;
  label: (phase: string) => string;
  fallback?: StatusTone;
};

/**
 * A kind's status phases: the locale prefix of their labels, and the tone
 * each one reads as. `check-i18n-keys` checks every listed phase's label.
 */
export const phases = (
  prefix: string,
  tones: Record<string, StatusTone>,
  { fallback, lowercase }: Options = {},
): Phases => ({
  tones,
  fallback,
  label: (phase) => `${prefix}.${lowercase ? phase.toLowerCase() : phase}`,
});

/** The tone classes of a phase, or undefined when it has none. */
export const phaseTone = (
  { tones, fallback }: Phases,
  phase: string | null | undefined,
): string | undefined => {
  const tone = (phase ? tones[phase] : undefined) ?? fallback;
  return tone ? STATUS_TONE[tone] : undefined;
};
