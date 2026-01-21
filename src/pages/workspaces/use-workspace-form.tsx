import FormCardGrid from "@/components/business/FormCardGrid";
import { Field } from "@/components/theme";
import { Input } from "@/components/ui/input";
import type { Workspace } from "@/types";
import { useTranslation } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";

export const useWorkspaceForm = ({ action }: { action: "create" | "edit" }) => {
  const isEdit = action === "edit";
  const { translate } = useTranslation();

  const form = useForm<Workspace>({
    mode: "all",
    defaultValues: {
      api_version: "v1",
      kind: "Workspace",
      metadata: {
        name: "",
      },
    },
    refineCoreProps: {},
    warnWhenUnsavedChanges: true,
  });

  return {
    form,
    metadataFields: (
      <FormCardGrid title={translate("common.sections.basicInformation")}>
        <Field
          {...form}
          name="metadata.name"
          label={translate("common.fields.name")}
        >
          <Input
            placeholder={translate("workspaces.placeholders.workspaceName")}
            disabled={isEdit}
          />
        </Field>
      </FormCardGrid>
    ),
  };
};
