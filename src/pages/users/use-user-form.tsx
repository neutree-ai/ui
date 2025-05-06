import { useForm } from "@refinedev/react-hook-form";
import { Field } from "@/components/theme";
import type { UserProfile } from "@/types";
import FormCardGrid from "@/components/business/FormCardGrid";
import { Input } from "@/components/ui/input";

export const useUserForm = ({ action }: { action: "create" | "edit" }) => {
  const isEdit = action === "edit";

  const form = useForm<UserProfile>({
    mode: "all",
    defaultValues: isEdit
      ? {
          api_version: "v1",
          kind: "UserProfile",
          metadata: {
            name: "",
          },
          spec: {
            email: "",
          },
        }
      : {
          name: "",
          email: "",
          password: "",
          confirmPassword: "",
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
    registerFields: (
      <FormCardGrid>
        <Field {...form} name="name" label="Name">
          <Input placeholder="User Name" />
        </Field>
        <Field {...form} name="email" label="Email">
          <Input placeholder="User Email" type="email" />
        </Field>
        <div className="col-span-2" />
        <Field {...form} name="password" label="Password">
          <Input type="password" />
        </Field>
        <Field {...form} name="confirmPassword" label="Confirm Password">
          <Input type="password" />
        </Field>
      </FormCardGrid>
    ),
    metadataFields: (
      <FormCardGrid title="Basic Information">
        <Field {...form} name="metadata.name" label="Name">
          <Input placeholder="User Name" disabled={isEdit} />
        </Field>
      </FormCardGrid>
    ),
    specFields: (
      <FormCardGrid>
        <Field {...form} name="spec.email" label="Email">
          <Input type="email" />
        </Field>
      </FormCardGrid>
    ),
  };
};
