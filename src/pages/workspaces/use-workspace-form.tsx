import { useForm } from "@refinedev/react-hook-form";
import { Field } from "@/components/theme";
import type { Workspace } from "@/types";
import FormCardGrid from "@/components/business/FormCardGrid";
import { Input } from "@/components/ui/input";

export const useWorkspaceForm = ({ action }: { action: "create" | "edit" }) => {
  const isEdit = action === "edit";

  const form = useForm<Workspace>({
    mode: "all",
    defaultValues: {
      api_version: "v1",
      kind: "Workspace",
      metadata: {
        name: "",
      },
    },
    refineCoreProps: {
      autoSave: {
        enabled: true,
      },
    },
    warnWhenUnsavedChanges: true,
  });

  return {
    form,
    metadataFields: (
      <FormCardGrid title="Basic Information">
        <Field {...form} name="metadata.name" label="Name">
          <Input placeholder="Workspace Name" disabled={isEdit} />
        </Field>
      </FormCardGrid>
    ),
  };
};
