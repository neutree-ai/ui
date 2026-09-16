/**
 * How a model registry's detail page names the model its drawer shows, in the
 * URL. Shared so a page that links to a model (the endpoint detail page does)
 * and the registry page that reads the link cannot drift apart.
 */

export type RegistryModelSelection = { model: string; version: string };

const MODEL_PARAM = "model";
const VERSION_PARAM = "version";

/** The query that opens a model. An empty version is left out and reads as
 * the latest one, which is what the models API does with it too. */
export const registryModelQuery = ({
  model,
  version,
}: RegistryModelSelection): Record<string, string> =>
  version
    ? { [MODEL_PARAM]: model, [VERSION_PARAM]: version }
    : { [MODEL_PARAM]: model };

export const readRegistryModelSelection = (
  params: URLSearchParams,
): RegistryModelSelection | null => {
  const model = params.get(MODEL_PARAM);
  return model ? { model, version: params.get(VERSION_PARAM) ?? "" } : null;
};

/** `params` with the selection replaced; `null` clears it. */
export const writeRegistryModelSelection = (
  params: URLSearchParams,
  selection: RegistryModelSelection | null,
): URLSearchParams => {
  const next = new URLSearchParams(params);
  next.delete(MODEL_PARAM);
  next.delete(VERSION_PARAM);
  for (const [key, value] of Object.entries(
    selection ? registryModelQuery(selection) : {},
  )) {
    next.set(key, value);
  }
  return next;
};
