import type { ReactNode } from "react";
import type { ModelCatalog } from "@/domains/model-catalog/types";
import { type DetailField, field } from "@/foundation/scene/detail-field";
import type { ModelSpec } from "@/foundation/types/serving-types";

/** A catalog with the model of the variant the page shows. */
type ServingProfile = {
  catalog: ModelCatalog;
  model?: ModelSpec | null;
};

type Render = (profile: ServingProfile) => ReactNode;

const modelFile: DetailField<ServingProfile> = field(
  "model_catalogs.fields.modelFile",
  (profile) => profile.model?.file,
);

/**
 * Header and serving-profile fields. The page supplies the engine, model and
 * task renderers, which belong to the endpoint domain.
 */
export const servingProfileFields = (
  profile: ServingProfile,
  show: { engine: Render; model: Render; task: Render },
) => {
  const header: DetailField<ServingProfile>[] = [
    field("common.fields.engine", { render: show.engine }),
    field("common.fields.model", { render: show.model }, { span: 2 }),
    field("common.fields.task", { render: show.task }),
  ];
  return {
    header,
    profile: [...header, ...(profile.model?.file ? [modelFile] : [])],
  };
};
