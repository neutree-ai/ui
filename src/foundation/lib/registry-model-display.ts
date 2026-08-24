import type { RegistryModel } from "@/foundation/types/model-types";

/**
 * The label to show for a model: its alias when one of its versions carries
 * one, otherwise the physical name.
 *
 * The alias is a label only — it never reaches `spec.model.name`, so renaming
 * it later leaves existing endpoints pointing where they always did. Aliases
 * are scoped to their registry, so the same alias under two registries stays
 * two different models. Public registries carry none and take the fallback.
 *
 * Aliases live on versions, so a model can have several; the first wins,
 * matching the order the registry reports.
 */
export function registryModelLabel(model: RegistryModel): string {
  return model.versions?.find((version) => version.alias)?.alias || model.name;
}

/**
 * The version to fill in when a model is picked, or undefined when the registry
 * reported none. The first one, in the registry's own order.
 */
export function registryModelDefaultVersion(
  model: RegistryModel,
): string | undefined {
  return model.versions?.[0]?.name || undefined;
}
