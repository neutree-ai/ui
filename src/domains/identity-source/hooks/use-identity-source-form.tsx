import type { BaseRecord, HttpError } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { ShieldAlert } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { StringListInput } from "@/domains/identity-source/components/StringListInput";
import { identitySourceErrorMessage } from "@/domains/identity-source/lib/identity-source-errors";
import {
  createFormDefaults,
  hasUsernamePlaceholder,
  type IdentitySourceFormValues,
  isAllowedRedirectUrl,
  isHttpUrl,
  isLdapsUrl,
  isLdapUrl,
  isPemBundleOrEmpty,
  isValidIdentitySourceName,
  scopesIncludeOpenid,
  toFormValues,
  toIdentitySourcePayload,
} from "@/domains/identity-source/lib/identity-source-values";
import type { IdentitySource } from "@/domains/identity-source/types";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { FormSelect } from "@/foundation/components/FormSelect";
import { REST_URL } from "@/foundation/lib/api";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { useTranslation } from "@/foundation/lib/i18n";
import { ssoRedirectTarget } from "@/foundation/lib/sso-callback";

const required = (message: string) => ({
  validate: (value: unknown) =>
    (typeof value === "string" ? value.trim() !== "" : value != null) ||
    message,
});

export const useIdentitySourceForm = ({
  action,
}: {
  action: "create" | "edit";
}) => {
  const { t } = useTranslation();
  const isEdit = action === "edit";
  const uiRootUrl = ssoRedirectTarget();

  const errorNotification = (error?: HttpError) => ({
    type: "error" as const,
    message: t(
      isEdit
        ? "identity_sources.messages.saveFailed"
        : "identity_sources.messages.createFailed",
    ),
    description:
      identitySourceErrorMessage(t, error) ??
      getErrorMessage(error, t("pages.error.unknown")),
  });

  const form = useForm<IdentitySource>({
    mode: "all",
    defaultValues: createFormDefaults(REST_URL, uiRootUrl),
    refineCoreProps: {
      errorNotification,
      queryOptions: {
        // The edit form holds both sub-objects and blank secrets; see toFormValues.
        select: (data) => ({
          ...data,
          data: toFormValues(
            data.data as IdentitySource,
            REST_URL,
            uiRootUrl,
          ) as unknown as IdentitySource,
        }),
      },
    },
    warnWhenUnsavedChanges: true,
  });

  const originalOnFinish = form.refineCore.onFinish;
  form.refineCore.onFinish = async (values) =>
    originalOnFinish(
      toIdentitySourcePayload(
        values as IdentitySourceFormValues,
        action,
      ) as unknown as IdentitySourceFormValues & BaseRecord,
    );

  const type = form.watch("spec.type");
  const startTls = form.watch("spec.ldap.start_tls") === true;
  const insecureSkipVerify =
    form.watch("spec.ldap.insecure_skip_verify") === true;
  const enabled = form.watch("spec.enabled") === true;

  const secretDescription = (createHint: string) =>
    isEdit ? t("identity_sources.hints.keepSecret") : createHint;

  const checkbox = (
    name: "spec.ldap.start_tls" | "spec.ldap.insecure_skip_verify",
    checked: boolean,
    label: string,
    description?: string,
  ): ReactNode => (
    <FormFieldGroup
      {...form}
      name={name}
      label={label}
      description={description}
      isCheckbox
      className="col-span-2"
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) =>
          form.setValue(name, value === true, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
      />
    </FormFieldGroup>
  );

  // Keyed so switching type mounts fresh fields instead of renaming the
  // previous type's controllers in place (which shows their stale values).
  const ldapFields = (
    <Fragment key="ldap">
      <FormCardGrid title={t("identity_sources.sections.ldapConnection")}>
        <FormFieldGroup
          {...form}
          name="spec.ldap.url"
          label={t("identity_sources.fields.ldapUrl")}
          required
          className="col-span-2"
          rules={{
            validate: (value: string) => {
              if (!value?.trim())
                return t("identity_sources.validation.required");
              if (!isLdapUrl(value))
                return t("identity_sources.validation.ldapUrl");
              if (form.getValues("spec.ldap.start_tls") && isLdapsUrl(value)) {
                return t("identity_sources.validation.startTlsWithLdaps");
              }
              return true;
            },
          }}
        >
          <Input placeholder="ldaps://ldap.example.org:636" />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.ldap.timeout"
          label={t("identity_sources.fields.timeout")}
          rules={{
            validate: (value: unknown) =>
              value === "" ||
              value == null ||
              (Number.isInteger(Number(value)) && Number(value) >= 0) ||
              t("identity_sources.validation.timeout"),
          }}
        >
          <Input type="number" min={0} />
        </FormFieldGroup>
        <div />
        {checkbox(
          "spec.ldap.start_tls",
          startTls,
          t("identity_sources.fields.startTls"),
        )}
        {checkbox(
          "spec.ldap.insecure_skip_verify",
          insecureSkipVerify,
          t("identity_sources.fields.insecureSkipVerify"),
          t("identity_sources.hints.insecureSkipVerify"),
        )}
        <FormFieldGroup
          {...form}
          name="spec.ldap.ca_cert"
          label={t("identity_sources.fields.caCert")}
          description={t("identity_sources.hints.caCert")}
          className="col-span-4"
          rules={{
            validate: (value: string) =>
              isPemBundleOrEmpty(value) || t("identity_sources.validation.pem"),
          }}
        >
          <Textarea
            rows={4}
            className="font-mono text-xs"
            placeholder="-----BEGIN CERTIFICATE-----"
          />
        </FormFieldGroup>
      </FormCardGrid>
      <FormCardGrid title={t("identity_sources.sections.ldapBind")}>
        <FormFieldGroup
          {...form}
          name="spec.ldap.bind_dn"
          label={t("identity_sources.fields.bindDn")}
          required
          className="col-span-2"
          rules={required(t("identity_sources.validation.required"))}
        >
          <Input placeholder="cn=svc-neutree,ou=services,dc=example,dc=org" />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.ldap.bind_password"
          label={t("identity_sources.fields.bindPassword")}
          required={!isEdit}
          description={secretDescription(
            t("identity_sources.hints.bindPassword"),
          )}
          className="col-span-2"
          rules={
            isEdit
              ? undefined
              : required(t("identity_sources.validation.required"))
          }
        >
          <Input type="password" autoComplete="new-password" />
        </FormFieldGroup>
      </FormCardGrid>
      <FormCardGrid title={t("identity_sources.sections.ldapUsers")}>
        <FormFieldGroup
          {...form}
          name="spec.ldap.user_base_dn"
          label={t("identity_sources.fields.userBaseDn")}
          required
          className="col-span-2"
          rules={required(t("identity_sources.validation.required"))}
        >
          <Input placeholder="ou=people,dc=example,dc=org" />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.ldap.user_filter"
          label={t("identity_sources.fields.userFilter")}
          description={t("identity_sources.hints.userFilter")}
          required
          className="col-span-2"
          rules={{
            validate: (value: string) => {
              if (!value?.trim())
                return t("identity_sources.validation.required");
              return (
                hasUsernamePlaceholder(value) ||
                t("identity_sources.validation.userFilter")
              );
            },
          }}
        >
          <Input placeholder="(uid={username})" />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.ldap.attributes.id"
          label={t("identity_sources.fields.attrId")}
        >
          <Input placeholder="entryUUID" />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.ldap.attributes.username"
          label={t("identity_sources.fields.attrUsername")}
        >
          <Input placeholder="uid" />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.ldap.attributes.email"
          label={t("identity_sources.fields.attrEmail")}
        >
          <Input placeholder="mail" />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.ldap.attributes.display_name"
          label={t("identity_sources.fields.attrDisplayName")}
        >
          <Input placeholder="cn" />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.ldap.attributes.member_of"
          label={t("identity_sources.fields.attrMemberOf")}
        >
          <Input placeholder="memberOf" />
        </FormFieldGroup>
      </FormCardGrid>
    </Fragment>
  );

  const oidcFields = (
    <Fragment key="oidc">
      <FormCardGrid title={t("identity_sources.sections.oidcProvider")}>
        <FormFieldGroup
          {...form}
          name="spec.oidc.issuer"
          label={t("identity_sources.fields.issuer")}
          required
          className="col-span-2"
          rules={{
            validate: (value: string) => {
              if (!value?.trim())
                return t("identity_sources.validation.required");
              return (
                isHttpUrl(value) || t("identity_sources.validation.httpUrl")
              );
            },
          }}
        >
          <Input placeholder="https://idp.example.org/realms/neutree" />
        </FormFieldGroup>
        <div className="col-span-2" />
        <FormFieldGroup
          {...form}
          name="spec.oidc.client_id"
          label={t("identity_sources.fields.clientId")}
          required
          className="col-span-2"
          rules={required(t("identity_sources.validation.required"))}
        >
          <Input />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.oidc.client_secret"
          label={t("identity_sources.fields.clientSecret")}
          required={!isEdit}
          description={secretDescription(
            t("identity_sources.hints.clientSecret"),
          )}
          className="col-span-2"
          rules={
            isEdit
              ? undefined
              : required(t("identity_sources.validation.required"))
          }
        >
          <Input type="password" autoComplete="new-password" />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.oidc.scopes"
          label={t("identity_sources.fields.scopes")}
          description={t("identity_sources.hints.scopes")}
          className="col-span-2"
          rules={{
            validate: (value: string[]) =>
              scopesIncludeOpenid(value) ||
              t("identity_sources.validation.scopes"),
          }}
        >
          <StringListInput mode="words" placeholder="openid profile email" />
        </FormFieldGroup>
        <div className="col-span-2" />
        <FormFieldGroup
          {...form}
          name="spec.oidc.ca_cert"
          label={t("identity_sources.fields.caCert")}
          description={t("identity_sources.hints.oidcCaCert")}
          className="col-span-4"
          rules={{
            validate: (value: string) =>
              isPemBundleOrEmpty(value) || t("identity_sources.validation.pem"),
          }}
        >
          <Textarea
            rows={4}
            className="font-mono text-xs"
            placeholder="-----BEGIN CERTIFICATE-----"
          />
        </FormFieldGroup>
      </FormCardGrid>
      <FormCardGrid title={t("identity_sources.sections.oidcRedirects")}>
        <FormFieldGroup
          {...form}
          name="spec.oidc.redirect_url"
          label={t("identity_sources.fields.redirectUrl")}
          description={t("identity_sources.hints.redirectUrl")}
          required
          className="col-span-4"
          rules={{
            validate: (value: string) => {
              if (!value?.trim())
                return t("identity_sources.validation.required");
              return (
                isHttpUrl(value) || t("identity_sources.validation.httpUrl")
              );
            },
          }}
        >
          <Input />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.oidc.allowed_redirects"
          label={t("identity_sources.fields.allowedRedirects")}
          description={t("identity_sources.hints.allowedRedirects")}
          required
          className="col-span-4"
          rules={{
            validate: (value: string[]) => {
              const entries = (value ?? [])
                .map((v) => v.trim())
                .filter(Boolean);
              if (entries.length === 0) {
                return t(
                  "identity_sources.validation.allowedRedirectsRequired",
                );
              }
              return (
                entries.every(isAllowedRedirectUrl) ||
                t("identity_sources.validation.allowedRedirect")
              );
            },
          }}
        >
          <StringListInput mode="lines" />
        </FormFieldGroup>
      </FormCardGrid>
      <FormCardGrid title={t("identity_sources.sections.oidcClaims")}>
        <FormFieldGroup
          {...form}
          name="spec.oidc.claims.username"
          label={t("identity_sources.fields.claimUsername")}
        >
          <Input placeholder="preferred_username" />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.oidc.claims.display_name"
          label={t("identity_sources.fields.claimDisplayName")}
        >
          <Input placeholder="name" />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.oidc.claims.email"
          label={t("identity_sources.fields.claimEmail")}
        >
          <Input placeholder="email" />
        </FormFieldGroup>
      </FormCardGrid>
    </Fragment>
  );

  return {
    form,
    metadataFields: (
      <FormCardGrid title={t("common.sections.basicInformation")}>
        <FormFieldGroup
          {...form}
          name="metadata.name"
          label={t("common.fields.name")}
          description={isEdit ? undefined : t("identity_sources.hints.name")}
          required
          rules={{
            validate: (value: string) => {
              if (isEdit) return true;
              if (!value?.trim())
                return t("identity_sources.validation.required");
              return (
                isValidIdentitySourceName(value.trim()) ||
                t("identity_sources.validation.name")
              );
            },
          }}
        >
          <Input placeholder="corp-ldap" disabled={isEdit} />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="metadata.display_name"
          label={t("identity_sources.fields.displayName")}
          description={t("identity_sources.hints.displayName")}
        >
          <Input />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.type"
          label={t("common.fields.type")}
          description={
            isEdit ? t("identity_sources.hints.typeImmutable") : undefined
          }
          required
        >
          <FormSelect
            disabled={isEdit}
            options={[
              { label: t("identity_sources.types.ldap"), value: "ldap" },
              { label: t("identity_sources.types.oidc"), value: "oidc" },
            ]}
          />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="spec.enabled"
          label={t("identity_sources.fields.enabled")}
          description={t("identity_sources.hints.enabled")}
        >
          {/* Centred in the 32px row the inputs occupy, so its description
          lines up with theirs. */}
          <Switch
            checked={enabled}
            className="flex !my-3.5"
            onCheckedChange={(value) =>
              form.setValue("spec.enabled", value, { shouldDirty: true })
            }
          />
        </FormFieldGroup>
      </FormCardGrid>
    ),
    specFields: type === "oidc" ? oidcFields : ldapFields,
    adminNote: (
      <Alert variant="warning" data-testid="identity-source-admin-note">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          {t("identity_sources.hints.adminEquivalent")}
        </AlertDescription>
      </Alert>
    ),
  };
};
