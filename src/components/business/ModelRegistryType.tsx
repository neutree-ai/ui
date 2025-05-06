import type { ModelRegistry } from "@/types";

const ModelRegistryType = ({ type }: Pick<ModelRegistry["spec"], "type">) => {
  return (
    <div className="flex gap-1 items-center">
      <img
        className="w-6 h-6"
        src={
          type === "bentoml"
            ? "https://docs.bentoml.com/en/latest/_static/img/logo-light.svg"
            : "https://huggingface.co/front/assets/huggingface_logo-noborder.svg"
        }
      />
      <div>{type}</div>
    </div>
  );
};

export default ModelRegistryType;
