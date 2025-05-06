import { Form } from "@/components/theme";
import { useWorkspaceForm } from "./use-workspace-form";

export const WorkspacesCreate = () => {
  const { form, metadataFields } = useWorkspaceForm({ action: "create" });

  return <Form {...form}>{metadataFields}</Form>;
};
