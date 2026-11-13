import { useCallback, useState } from "react";
import { LocalStorageAdapter } from "@/foundation/lib/column-visibility-storage";

const STORAGE_KEY = "neutree_model_usage_scope_collapsed";
const storage = new LocalStorageAdapter();

/** Whether the scope panel is folded to a rail; remembered across visits. */
export const useScopeCollapsed = () => {
  const [collapsed, setCollapsed] = useState(
    () => storage.getItem(STORAGE_KEY) === "1",
  );
  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      storage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);
  return [collapsed, toggle] as const;
};
