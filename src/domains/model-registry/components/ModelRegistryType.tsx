import { Boxes, Folder } from "lucide-react";
import type { ReactNode } from "react";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { PRIVATE_MODEL_REGISTRY_TYPE } from "@/foundation/lib/constant";
import { useTranslation } from "@/foundation/lib/i18n";

/**
 * How a registry kind is presented: its icon, its name, and the example address
 * its URL field offers.
 *
 * This table is the one place allowed to read `spec.type`. Nothing the UI *does*
 * with a registry may branch on it — what can be listed, measured, paged or
 * written follows from what the server reported about the registry itself, in
 * `@/foundation/lib/model-registry-visibility`, `@/foundation/lib/model-registry-availability`
 * and `../lib/provisioning`. A
 * kind missing from this table still works everywhere else; it renders under its
 * raw identifier, which is a plain label rather than a broken page.
 *
 * Icons are drawn locally rather than fetched from the hub they stand for.
 * neutree is installed into networks with no route out, where a remote logo
 * resolves to a broken image and no fallback — on a page an air-gapped operator
 * uses constantly. Hugging Face predates that reasoning and is left as it was.
 */
type ModelRegistryTypePresentation = {
  icon: ReactNode;
  label: (t: (key: string) => string) => string;
  urlPlaceholder: (t: (key: string) => string) => string;
};

const iconClassName = "w-6 h-6";

const PRESENTATION: Record<string, ModelRegistryTypePresentation> = {
  "hugging-face": {
    icon: (
      <img
        className={iconClassName}
        src="https://huggingface.co/front/assets/huggingface_logo-noborder.svg"
        alt="Model Registry Icon"
      />
    ),
    label: (t) => t("model_registries.types.huggingFace"),
    urlPlaceholder: (t) => t("model_registries.placeholders.huggingFaceUrl"),
  },
  "model-scope": {
    icon: <Boxes className={iconClassName} />,
    label: (t) => t("model_registries.types.modelScope"),
    urlPlaceholder: (t) => t("model_registries.placeholders.modelScopeUrl"),
  },
  [PRIVATE_MODEL_REGISTRY_TYPE]: {
    icon: <Folder className={iconClassName} />,
    label: (t) => t("model_registries.types.fileSystem"),
    urlPlaceholder: (t) => t("model_registries.placeholders.fileSystemUrl"),
  },
};

/**
 * Every kind the server defines, in the order menus offer them — the same three
 * as `ModelRegistryType` in `api/v1/model_registry_types.go`.
 *
 * Two menus read it: the create form, and the list's type filter. Those are
 * different questions — "what may I make" and "what may the server report" —
 * that happen to have the same answer, because every kind defined today is one
 * a user may create. Should a kind ever become provisioned-only, the filter has
 * to keep following the server's enum while the create form drops it, and they
 * part company here.
 *
 * Spelt out rather than derived from the table above, so that describing a new
 * kind does not reorder a menu people are used to.
 */
const KNOWN_TYPES = [
  "hugging-face",
  "model-scope",
  PRIVATE_MODEL_REGISTRY_TYPE,
];

/** The kind a create form starts on. */
export const DEFAULT_MODEL_REGISTRY_TYPE = "hugging-face";

/** Every kind, localized, for a menu that offers one per entry. */
export const modelRegistryTypeOptions = (t: (key: string) => string) =>
  KNOWN_TYPES.map((value) => ({
    label: PRESENTATION[value].label(t),
    value,
  }));

/** The example address to show in the URL field, or nothing for a kind this
 * build cannot describe — an invented example would be worse than none. */
export const modelRegistryUrlPlaceholder = (
  type: string,
  t: (key: string) => string,
) => PRESENTATION[type]?.urlPlaceholder(t);

const ModelRegistryType = ({ type }: Pick<ModelRegistry["spec"], "type">) => {
  const { t } = useTranslation();
  const presentation: ModelRegistryTypePresentation | undefined =
    PRESENTATION[type];

  return (
    <div className="flex gap-1 items-center">
      {presentation?.icon}
      <div>{presentation ? presentation.label(t) : type}</div>
    </div>
  );
};

export default ModelRegistryType;
