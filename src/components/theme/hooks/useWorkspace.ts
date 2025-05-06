import { useList, useParsed } from "@refinedev/core";
import { useEffect } from "react";
import { useLocalStorage } from "react-use";

const WORKSPACE_STORAGE_KEY = "__workspace__";
export const ALL_WORKSPACES = "_all_";

export const useWorkspace = () => {
  const { params } = useParsed();
  const [value, setValue] = useLocalStorage<string>(WORKSPACE_STORAGE_KEY);
  useEffect(() => {
    if (params?.workspace !== value) {
      setValue(params?.workspace);
    }
  }, [params?.workspace, setValue, value]);

  const { data } = useList({
    resource: "workspaces",
  });

  const preferred =
    data?.data?.find((workspace) => workspace.metadata.name === value)?.metadata
      .name || ALL_WORKSPACES;
  const current =
    data?.data?.find(
      (workspace) => workspace.metadata.name === params?.workspace
    )?.metadata.name ||
    preferred ||
    ALL_WORKSPACES;

  return {
    current,
    data: data?.data || [],
  };
};
