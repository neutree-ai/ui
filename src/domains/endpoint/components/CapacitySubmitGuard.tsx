import { useContext, useLayoutEffect } from "react";
import { ResourceFormSubmitContext } from "@/foundation/components/resource-form-submit-context";

// Headless guard that blocks the resource form's submit while a requested
// resource (CPU / memory / GPU / vGPU) exceeds the target node's available
// capacity. Registers a before-submit handler that returns false when blocked
// (the resource cards render the human-readable warnings). Renders nothing.
export function CapacitySubmitGuard({ blocked }: { blocked: boolean }) {
  const submitContext = useContext(ResourceFormSubmitContext);

  useLayoutEffect(() => {
    if (!submitContext) return;
    return submitContext.registerBeforeSubmit(() => !blocked);
  }, [submitContext, blocked]);

  return null;
}
