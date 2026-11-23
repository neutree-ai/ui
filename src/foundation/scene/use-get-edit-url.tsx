import { useNavigation, useResource } from "@refinedev/core";

export const useGetEditUrl = (
  resource: string,
  recordItemId: string,
  meta?: any,
): { url: string } => {
  const { editUrl: generateEditUrl } = useNavigation();

  const { id } = useResource(resource);

  const editUrl =
    resource && (recordItemId ?? id)
      ? generateEditUrl(resource, recordItemId ?? id, meta)
      : "";

  return {
    url: editUrl,
  };
};
