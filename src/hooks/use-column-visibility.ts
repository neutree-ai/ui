import {
  type ColumnVisibilityState,
  getColumnVisibility,
  setColumnVisibility,
} from "@/lib/column-visibility-storage";
import { useCallback, useEffect, useState } from "react";

export function useColumnVisibility(resourceName: string) {
  const [columnVisibility, setColumnVisibilityState] =
    useState<ColumnVisibilityState>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    const savedVisibility = getColumnVisibility(resourceName);
    if (savedVisibility) {
      setColumnVisibilityState(savedVisibility);
    }
    setIsLoaded(true);
  }, [resourceName]);

  // Update column visibility and save to storage with cleanup
  const updateColumnVisibility = useCallback(
    (
      visibilityOrUpdater:
        | ColumnVisibilityState
        | ((prev: ColumnVisibilityState) => ColumnVisibilityState),
      validColumnIds?: string[],
    ) => {
      setColumnVisibilityState((prev) => {
        const newVisibility =
          typeof visibilityOrUpdater === "function"
            ? visibilityOrUpdater(prev)
            : visibilityOrUpdater;

        setColumnVisibility(resourceName, newVisibility, validColumnIds);
        return newVisibility;
      });
    },
    [resourceName],
  );

  return {
    columnVisibility,
    setColumnVisibility: updateColumnVisibility,
    isLoaded,
  };
}
