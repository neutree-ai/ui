import { useState } from "react";

type Capacity = { enabled?: boolean; l1_size_gib?: unknown };

export function useCacheCapacityConfirmation() {
  const [pending, setPending] = useState<{
    save: () => void;
    disable: boolean;
  } | null>(null);
  const confirmCapacity = (
    before: Capacity | undefined,
    after: Capacity | undefined,
    save: () => void,
  ) => {
    if (
      before?.enabled &&
      (!after?.enabled ||
        Number(before.l1_size_gib) !== Number(after.l1_size_gib))
    ) {
      setPending({ save, disable: !after?.enabled });
    } else save();
  };
  const cancel = () => setPending(null);
  const confirm = () => {
    const save = pending?.save;
    setPending(null);
    save?.();
  };
  return {
    confirmCapacity,
    pending,
    cancel,
    confirm,
  };
}
