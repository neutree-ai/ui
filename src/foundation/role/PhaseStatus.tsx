import { useTranslation } from "@/foundation/lib/i18n";
import BaseStatus from "@/foundation/role/BaseStatus";
import { type Phases, phaseTone } from "@/foundation/role/phases";
import type { BaseStatus as BaseStatusType } from "@/foundation/types/basic-types";

/** A record's status phase as a toned chip, with its error and last transition on hover. */
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
      {...status}
      className={phaseTone(phases, phase)}
      translatedPhase={phase ? t(phases.label(phase)) : ""}
    />
  );
}
