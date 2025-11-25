import FormCardGrid from "@/components/business/FormCardGrid";
import { Field } from "@/components/theme";
import { Input } from "@/components/ui/input";
import type { UserProfile } from "@/types";
import { useTranslation } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";

export const useUserForm = ({ action }: { action: "create" | "edit" }) => {
  const isEdit = action === "edit";
  const { translate } = useTranslation();

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
    refineCoreProps: {},
    warnWhenUnsavedChanges: true,
  });

  return {
    form,
    registerFields: isEdit ? null : (
      <FormCardGrid>
        <Field
          {...form}
          name="name"
          label={translate("user_profiles.fields.name")}
        >
          <Input
            placeholder={translate("user_profiles.placeholders.userName")}
          />
        </Field>
        <Field
          {...form}
          name="email"
          label={translate("user_profiles.fields.email")}
        >
          <Input
            placeholder={translate("user_profiles.placeholders.userEmail")}
            type="email"
          />
        </Field>
        <div className="col-span-2" />
        <Field
          {...form}
          name="password"
          label={translate("user_profiles.fields.password")}
        >
          <Input type="password" />
        </Field>
        <Field
          {...form}
          label={translate("user_profiles.fields.confirmPassword")}
          {...form.register("confirmPassword", {
            required: {
              value: true,
              message: translate(
                "user_profiles.validation.confirmPasswordRequired",
              ),
            },
            validate: (value: string) => {
              return (
                value === form.getValues("password") ||
                translate("user_profiles.validation.confirmPasswordNotMatch")
              );
            },
          })}
        >
          <Input type="password" />
        </Field>
      </FormCardGrid>
    ),
    metadataFields: (
      <FormCardGrid title={translate("user_profiles.fields.basicInformation")}>
        <Field
          {...form}
          name="metadata.name"
          label={translate("user_profiles.fields.name")}
        >
          <Input
            placeholder={translate("user_profiles.placeholders.userName")}
            disabled={isEdit}
          />
        </Field>
      </FormCardGrid>
    ),
    specFields: (
      <FormCardGrid>
        <Field
          {...form}
          name="spec.email"
          label={translate("user_profiles.fields.email")}
        >
          <Input type="email" />
        </Field>
      </FormCardGrid>
    ),
  };
};
