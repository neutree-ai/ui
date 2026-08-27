import { ImageExplorerButton } from "@/domains/endpoint/components/ImageExplorerButton";
import { writesWorkloadImage } from "@/domains/endpoint/lib/recipe-image-feature";
import type { RecipeFeature } from "@/foundation/recipe/types";

interface WorkloadImageFeatureAddonProps {
  /** The engine the endpoint will run. */
  engine?: string | null;
  feature: RecipeFeature;
  workspace?: string | null;
  /** The registry the endpoint's cluster pulls with, if a cluster has been
   * picked. Only used to mark it in the explorer's registry list. */
  registry?: string | null;
  onChange: (value: string) => void;
}

/**
 * The registry explorer, offered beside a recipe feature that turns out to be
 * the Flex workload image.
 *
 * This is the path that needs it most. A catalog's default for that feature is
 * routinely a placeholder — `<your-registry>/neutree-flex-funasr:airgap-v0.1.2`
 * — which the user is required to replace and has nothing to replace it from.
 * On the endpoint path the field can at least be left alone.
 *
 * Renders nothing unless the engine is Flex and the feature writes the whole of
 * the `image` argument. Anything else keeps the input the catalog author asked
 * for, untouched.
 */
export function WorkloadImageFeatureAddon({
  engine,
  feature,
  workspace,
  registry,
  onChange,
}: WorkloadImageFeatureAddonProps) {
  if (engine !== "flex" || !writesWorkloadImage(feature)) {
    return null;
  }

  return (
    <ImageExplorerButton
      workspace={workspace}
      registry={registry}
      onApply={onChange}
    />
  );
}
