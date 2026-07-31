import { useList, useParsed, useResourceParams } from "@refinedev/core";
import { useEffect, useState } from "react";
import { useLocalStorage } from "react-use";
import { useDebouncedValue } from "@/foundation/hooks/use-debounced-value";

const WORKSPACE_STORAGE_KEY = "__workspace__";
export const ALL_WORKSPACES = "_all_";

export const isValidWorkspace = (
  workspace: string | undefined | null,
): boolean => {
  return !!workspace && workspace !== ALL_WORKSPACES;
};

// Workspace names live in a JSON column, so this is the field both the list
// page search and the pickers filter on.
export const WORKSPACE_NAME_FIELD = "metadata->>name";

// Big enough that most deployments never have to type, small enough to stay one
// cheap request. Past this a workspace is only reachable by searching for it.
const WORKSPACE_OPTIONS_PAGE_SIZE = 100;

// Searching on the server instead of filtering the first page locally is what
// makes a workspace past that page reachable at all (NEU-505).
export const useWorkspaceOptions = (search?: string) => {
  const { data, isLoading } = useList({
    resource: "workspaces",
    pagination: { pageSize: WORKSPACE_OPTIONS_PAGE_SIZE },
    filters: search
      ? [{ field: WORKSPACE_NAME_FIELD, operator: "contains", value: search }]
      : [],
    sorters: [{ field: WORKSPACE_NAME_FIELD, order: "asc" }],
    queryOptions: {
      // Keep the previous page on screen while a keystroke's query is in
      // flight, so the list doesn't blank out on every character.
      keepPreviousData: true,
    },
  });

  return {
    workspaces: data?.data || [],
    isLoading,
  };
};

// Everything a workspace picker needs: the option list plus the search box
// wiring that drives it. Debounced so a query goes out per pause, not per key.
export const useWorkspaceSearch = () => {
  const [search, setSearch] = useState("");
  const { workspaces, isLoading } = useWorkspaceOptions(
    useDebouncedValue(search),
  );

  return {
    options: workspaces.map((workspace) => ({
      label: workspace.metadata.name,
      value: workspace.metadata.name,
    })),
    isLoading,
    onSearchChange: setSearch,
  };
};

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

  // Shares the picker's query (and its page size) so a stored workspace far
  // down the list still resolves instead of silently falling back to "all".
  const { workspaces, isLoading } = useWorkspaceOptions();

  const preferred =
    workspaces.find((workspace) => workspace.metadata.name === value)?.metadata
      .name || ALL_WORKSPACES;

  const current = params?.workspace
    ? workspaces.find(
        (workspace) => workspace.metadata.name === params?.workspace,
      )?.metadata.name || params?.workspace
    : preferred;

  return {
    current,
    isLoading,
  };
};
