import { useList, useParsed, useResourceParams } from "@refinedev/core";
import { useEffect } from "react";
import { useLocalStorage } from "react-use";

const WORKSPACE_STORAGE_KEY = "__workspace__";
export const ALL_WORKSPACES = "_all_";

export const useWorkspace = () => {
  const { params } = useParsed();
  const { action } = useResourceParams();
  const [value, setValue] = useLocalStorage<string>(WORKSPACE_STORAGE_KEY);

  // Only sync URL workspace to localStorage when on list page
  // This prevents edit/show/create pages from changing the global workspace filter
  useEffect(() => {
    if (action === "list" && params?.workspace && params?.workspace !== value) {
      setValue(params?.workspace);
    }
  }, [action, params?.workspace, setValue, value]);

  const { data, isLoading } = useList({
    resource: "workspaces",
  });

  const preferred =
    data?.data?.find((workspace) => workspace.metadata.name === value)?.metadata
      .name || ALL_WORKSPACES;

  const current = params?.workspace
    ? data?.data?.find(
        (workspace) => workspace.metadata.name === params?.workspace,
      )?.metadata.name || params?.workspace
    : preferred;

  return {
    current,
    data: data?.data || [],
    isLoading,
  };
};
