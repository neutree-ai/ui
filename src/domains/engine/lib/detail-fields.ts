import type { Engine } from "@/domains/engine/types";
import { type DetailField, field } from "@/foundation/scene/detail-field";

export const engineHeaderFields: DetailField<Engine>[] = [
  field(
    "common.fields.versions",
    (engine) => engine.spec.versions?.length ?? 0,
  ),
  field(
    "engines.fields.supportedTasks",
    (engine) => engine.spec.supported_tasks?.length ?? 0,
  ),
];
