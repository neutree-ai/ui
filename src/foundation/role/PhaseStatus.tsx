import { useTranslation } from "@/foundation/lib/i18n";
import BaseStatus from "@/foundation/role/BaseStatus";
import { type Phases, phaseTone } from "@/foundation/role/phases";
import type { BaseStatus as BaseStatusType } from "@/foundation/types/basic-types";

/**
 * A record's status phase as a toned chip, with its error and last transition
 * on hover. Only those fields are passed on: a status can carry others, such as
 * an upstream status's `ref`, that are not props.
 */
export function PhaseStatus({
  status,
  phases,
}: {
  status: BaseStatusType | null | undefined;
  phases: Phases;
}) {
  const { t } = useTranslation();
  const phase = status?.phase;

  return (
    <BaseStatus
      phase={phase}
      error_message={status?.error_message}
      last_transition_time={status?.last_transition_time}
      className={phaseTone(phases, phase)}
      translatedPhase={phase ? t(phases.label(phase)) : ""}
    />
  );
}
