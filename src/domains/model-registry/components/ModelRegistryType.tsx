import type { ModelRegistry } from "@/domains/model-registry/types";
import { PRIVATE_MODEL_REGISTRY_TYPE } from "@/foundation/lib/constant";
import { Folder } from "lucide-react";
import { useTranslation } from "react-i18next";

const ModelRegistryType = ({ type }: Pick<ModelRegistry["spec"], "type">) => {
  const { t } = useTranslation();
  return (
    <div className="flex gap-1 items-center">
      {type === "hugging-face" && (
        <img
          className="w-6 h-6"
          src={
            "https://huggingface.co/front/assets/huggingface_logo-noborder.svg"
          }
          alt="Model Registry Icon"
        />
      )}
      {type === PRIVATE_MODEL_REGISTRY_TYPE && <Folder className="w-6 h-6" />}

      <div>
        {type === PRIVATE_MODEL_REGISTRY_TYPE
          ? t("model_registries.types.fileSystem")
          : type === "hugging-face"
            ? t("model_registries.types.huggingFace")
            : type}
      </div>
    </div>
  );
};

export default ModelRegistryType;
