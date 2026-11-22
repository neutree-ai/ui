import { STATUS_TONE } from "@/foundation/role/status-tone";

const PHASE_TONE: Record<string, string> = {
  Active: STATUS_TONE.positive,
  Expired: STATUS_TONE.serious,
  Invalid: STATUS_TONE.serious,
  Pending: STATUS_TONE.notice,
};

export const licensePhaseTone = (phase: string): string =>
  PHASE_TONE[phase] ?? STATUS_TONE.neutral;

export const licensePhaseLabelKey = (phase: string): string =>
  `license.phase.${phase.toLowerCase()}`;
