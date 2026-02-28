import { NeutreeForm } from "@/components/business/NeutreeForm";
import { useWorkspaceForm } from "./use-workspace-form";

export const WorkspacesCreate = () => {
  const { form, metadataFields } = useWorkspaceForm({ action: "create" });

  return <NeutreeForm {...form}>{metadataFields}</NeutreeForm>;
};
