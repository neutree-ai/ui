import { useWorkspaceForm } from "@/domains/workspace/hooks/use-workspace-form";
import { ResourceForm } from "@/foundation/scene/ResourceForm";

export const WorkspacesCreate = () => {
  const { form, metadataFields } = useWorkspaceForm({ action: "create" });

  return <ResourceForm {...form}>{metadataFields}</ResourceForm>;
};
