import { useWorkspace } from "@/components/theme/hooks";
import { useForm } from "@refinedev/react-hook-form";
import { Field, Select } from "@/components/theme";
import type { ModelRegistry } from "@/types";
import FormCardGrid from "@/components/business/FormCardGrid";
import { Input } from "@/components/ui/input";
import WorkspaceField from "@/components/business/WorkspaceField";

export const useModelRegistryForm = ({
  action,
}: {
  action: "create" | "edit";
}) => {
  const { current: currentWorkspace } = useWorkspace();
  const form = useForm<ModelRegistry>({
    mode: "all",
    defaultValues: {
      api_version: "v1",
      kind: "ModelRegistry",
      metadata: {
        name: "",
        workspace: currentWorkspace,
      },
      spec: {
        url: "",
        type: "hugging-face",
        credentials: "",
      },
    },
    refineCoreProps: {
      autoSave: {
        enabled: true,
      },
    },
    warnWhenUnsavedChanges: true,
  });

  const currentType: ModelRegistry["spec"]["type"] = form.watch("spec.type");

  const isEdit = action === "edit";

  return {
    form,
    metadataFields: (
      <FormCardGrid title="Basic Information">
        <Field {...form} name="metadata.name" label="Name">
          <Input placeholder="Model Registry Name" disabled={isEdit} />
        </Field>
        <Field {...form} name="metadata.workspace" label="Workspace">
          <WorkspaceField disabled={isEdit} />
        </Field>
      </FormCardGrid>
    ),
    specFields: (
      <FormCardGrid title="Model Registry">
        <Field {...form} name="spec.type" label="Type">
          <Select
            placeholder="Select Model Registry Type"
            options={[
              { label: "Hugging Face", value: "hugging-face" },
              { label: "File System", value: "bentoml" },
            ]}
          />
        </Field>
        <Field {...form} name="spec.url" label="URL">
          <Input
            placeholder={
              currentType === "hugging-face"
                ? "e.g https://huggingface.co"
                : "e.g file://path/to/registry"
            }
          />
        </Field>
        <Field
          {...form}
          name="spec.credentials"
          label="Credentials"
          description="Credentials for the model registry. For hugging face, it should be a HF token."
          className="col-span-4"
        >
          <Input placeholder="Credentials" type="password" />
        </Field>
      </FormCardGrid>
    ),
  };
};
