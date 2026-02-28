import { Input } from "@/components/ui/input";
import type { UserProfile } from "@/domains/user/types";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
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
        <FormFieldGroup
          {...form}
          name="name"
          label={translate("common.fields.name")}
        >
          <Input
            placeholder={translate("user_profiles.placeholders.userName")}
          />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="email"
          label={translate("common.fields.email")}
        >
          <Input
            placeholder={translate("user_profiles.placeholders.userEmail")}
            type="email"
          />
        </FormFieldGroup>
        <div className="col-span-2" />
        <FormFieldGroup
          {...form}
          label={translate("common.fields.password")}
          {...form.register("password", {
            minLength: {
              value: 6,
              message: translate("user_profiles.validation.passwordMinLength"),
            },
          })}
        >
          <Input type="password" />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          label={translate("user_profiles.fields.confirmPassword")}
          {...form.register("confirmPassword", {
            required: {
              value: true,
              message: translate("pages.auth.errors.confirmPasswordRequired"),
            },
            validate: (value: string) => {
              return (
                value === form.getValues("password") ||
                translate("pages.auth.errors.confirmPasswordNotMatch")
              );
            },
          })}
        >
          <Input type="password" />
        </FormFieldGroup>
      </FormCardGrid>
    ),
    metadataFields: (
      <FormCardGrid title={translate("common.sections.basicInformation")}>
        <FormFieldGroup
          {...form}
          name="metadata.name"
          label={translate("common.fields.name")}
        >
          <Input
            placeholder={translate("user_profiles.placeholders.userName")}
            disabled={isEdit}
          />
        </FormFieldGroup>
      </FormCardGrid>
    ),
    specFields: (
      <FormCardGrid>
        <FormFieldGroup
          {...form}
          name="spec.email"
          label={translate("common.fields.email")}
        >
          <Input type="email" />
        </FormFieldGroup>
      </FormCardGrid>
    ),
  };
};
