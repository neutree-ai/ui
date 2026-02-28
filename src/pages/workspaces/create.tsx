import { ResourceForm } from "@/foundation/components/ResourceForm";
import { useWorkspaceForm } from "./use-workspace-form";

export const WorkspacesCreate = () => {
  const { form, metadataFields } = useWorkspaceForm({ action: "create" });

  return <ResourceForm {...form}>{metadataFields}</ResourceForm>;
};
