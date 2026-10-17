import { useTranslation } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Input } from "@/components/ui/input";
import type { UserProfile } from "@/domains/user/types";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { translateApiError } from "@/foundation/lib/api-error-code";
import { profileIdentitySource } from "@/foundation/lib/user-identity";

/** User profile write errors → i18n keys (10260: migration 106). */
const USER_PROFILE_ERROR_KEYS: Readonly<Record<string, string>> = {
  "10260": "user_profiles.errors.externalEmailReadOnly",
};

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
    refineCoreProps: {
      // A known error code gets its own message; anything else keeps
      // refine's default notification.
      errorNotification: (error) => {
        const description = translateApiError(
          translate,
          error,
          USER_PROFILE_ERROR_KEYS,
        );
        return description
          ? {
              type: "error",
              message: translate("user_profiles.errors.saveFailed"),
              description,
            }
          : undefined;
      },
    },
    warnWhenUnsavedChanges: true,
  });

  // The email of a user from an identity source belongs to that source; the
  // database refuses to change it.
  const metadata = form.watch("metadata");
  const isExternal = isEdit && profileIdentitySource(metadata) !== "";

  const passwordField = isEdit
    ? null
    : form.register("password", {
        minLength: {
          value: 6,
          message: translate("user_profiles.validation.passwordMinLength"),
        },
      });

  const confirmPasswordField = isEdit
    ? null
    : form.register("confirmPassword", {
        required: {
          value: true,
          message: translate("pages.auth.errors.confirmPasswordRequired"),
        },
        validate: (value: string) =>
          value === form.getValues("password") ||
          translate("pages.auth.errors.confirmPasswordNotMatch"),
      });

  return {
    form,
    registerFields:
      passwordField && confirmPasswordField ? (
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
            {...passwordField}
          >
            <Input type="password" />
          </FormFieldGroup>
          <FormFieldGroup
            {...form}
            label={translate("user_profiles.fields.confirmPassword")}
            {...confirmPasswordField}
          >
            <Input type="password" />
          </FormFieldGroup>
        </FormCardGrid>
      ) : null,
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
          description={
            isExternal
              ? translate("user_profiles.hints.externalEmail")
              : undefined
          }
        >
          <Input type="email" disabled={isExternal} />
        </FormFieldGroup>
      </FormCardGrid>
    ),
  };
};
