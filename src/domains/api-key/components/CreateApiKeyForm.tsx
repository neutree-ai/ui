import { useCustomMutation, useInvalidate } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FieldValues } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiKeyPolicyFields } from "@/domains/api-key/components/ApiKeyPolicyFields";
import { ProjectPicker } from "@/domains/api-key/components/ProjectPicker";
import {
  type ApiKeyPolicyFormValues,
  apiKeyPolicyDefaults,
  buildApiKeyLimits,
} from "@/domains/api-key/hooks/use-api-key-policy";
import { createApiKeyErrorMessage } from "@/domains/api-key/lib/create-api-key-error";
import type { ApiKey } from "@/domains/api-key/types";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";
import { useWorkspaceOptions } from "@/foundation/hooks/use-workspace";

type FormValues = {
  name: string;
  workspace: string;
  project_id: string;
  description: string;
} & ApiKeyPolicyFormValues;

export const CreateApiKeyForm = ({
  onClose,
  initialWorkspace = "",
  initialProjectId = "",
  initialProjectName = "Ungrouped",
  onCreated,
}: {
  onClose?: () => void;
  initialWorkspace?: string;
  initialProjectId?: string;
  initialProjectName?: string;
  onCreated?: () => void | Promise<void>;
}) => {
  const { t } = useTranslation();
  const form = useForm<FormValues>({
    mode: "all",
    defaultValues: {
      name: "",
      workspace: initialWorkspace,
      project_id: initialProjectId,
      description: "",
      ...apiKeyPolicyDefaults(),
    },
  });
  const selectedWorkspace = form.watch("workspace");
  const previousWorkspace = useRef("");

  useEffect(() => {
    if (
      previousWorkspace.current &&
      previousWorkspace.current !== selectedWorkspace
    ) {
      form.setValue("project_id", "", { shouldValidate: true });
      setCreatedProjectName("Ungrouped");
    }
    previousWorkspace.current = selectedWorkspace;
  }, [form, selectedWorkspace]);
  // Shares the pickers' query so this form isn't stuck on refine's default
  // first page of 10 workspaces either (NEU-505). FormCombobox filters what it
  // is given locally, so the page size is the reach here.
  const { workspaces, isLoading: isLoadingWorkspaces } = useWorkspaceOptions();
  const [apiKey, setApiKey] = useState<ApiKey | null>(null);
  const [createdProjectName, setCreatedProjectName] =
    useState(initialProjectName);
  const [submitError, setSubmitError] = useState("");
  const { copy, copied } = useCopyToClipboard();

  const { mutateAsync } = useCustomMutation();
  const invalidate = useInvalidate();

  const handleCopy = (text: string) =>
    copy(text, {
      successMessage: t("components.apiKey.copySuccess"),
      successDescription: t("components.apiKey.copySuccessDescription"),
      errorMessage: t("components.apiKey.errors.copyFailed"),
    });

  const onSubmit = async (formValue: FieldValues) => {
    // Create with limits in one atomic call — quota + access live on the key's
    // spec.limits, so create_api_key takes the whole limits object.
    setSubmitError("");
    try {
      const { data } = await mutateAsync({
        url: "/rpc/create_api_key",
        method: "post",
        values: {
          p_workspace: formValue.workspace,
          p_name: null,
          p_display_name: formValue.name,
          p_project_id: formValue.project_id || null,
          p_description: formValue.description,
          p_quota: 0,
          p_limits: buildApiKeyLimits(formValue as ApiKeyPolicyFormValues),
        },
        successNotification: false,
        errorNotification: false,
      });
      await invalidate({
        resource: "api_keys",
        invalidates: ["list"],
      });
      await onCreated?.();
      setApiKey(data as ApiKey);
    } catch (cause) {
      setSubmitError(createApiKeyErrorMessage(cause));
    }
  };

  if (apiKey) {
    return (
      <div className="space-y-4">
        <Alert variant="success">
          <AlertDescription>
            {t("api_keys.messages.createSuccess")}
          </AlertDescription>
        </Alert>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="font-medium">Name</dt>
          <dd>{apiKey.metadata.display_name ?? apiKey.metadata.name}</dd>
          <dt className="font-medium">Project</dt>
          <dd>{createdProjectName}</dd>
          <dt className="font-medium">Description</dt>
          <dd>{apiKey.description || "-"}</dd>
        </dl>

        <div className="space-y-2">
          <div className="relative">
            <div className="p-3 bg-muted rounded-md border min-h-[60px] flex items-center">
              <code className="text-sm break-all font-mono leading-relaxed">
                {apiKey.status?.sk_value}
              </code>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => {
                if (apiKey?.status?.sk_value) {
                  handleCopy(apiKey.status.sk_value);
                }
              }}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  {t("api_keys.buttons.copied")}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  {t("api_keys.buttons.copy")}
                </>
              )}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            {t("buttons.close")}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        <FormFieldGroup
          {...form}
          name="workspace"
          label={t("common.fields.workspace")}
        >
          <FormCombobox
            placeholder={t("api_keys.placeholders.selectWorkspace")}
            disabled={Boolean(initialWorkspace) || isLoadingWorkspaces}
            options={workspaces.map((workspace) => ({
              label: workspace.metadata.name,
              value: workspace.metadata.name,
            }))}
          />
        </FormFieldGroup>
        <FormFieldGroup {...form} name="project_id" label="Project">
          <ProjectPicker
            workspace={selectedWorkspace}
            value={form.watch("project_id")}
            onChange={(id, project) => {
              form.setValue("project_id", id, { shouldValidate: true });
              setCreatedProjectName(project?.name ?? "Ungrouped");
            }}
          />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="name"
          label={t("common.fields.name")}
          rules={{
            required: "Name is required",
            maxLength: {
              value: 63,
              message: "Name cannot exceed 63 characters",
            },
            validate: (value) => value.trim().length > 0 || "Name is required",
          }}
        >
          <Input />
        </FormFieldGroup>
        <FormFieldGroup {...form} name="description" label="Description">
          <Textarea />
        </FormFieldGroup>

        <div className="pt-1 text-sm font-medium">
          {t("api_keys.limits.sectionTitle")}
        </div>
        <ApiKeyPolicyFields form={form} workspace={selectedWorkspace} />

        {submitError && (
          <p className="text-sm text-destructive">{submitError}</p>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("buttons.cancel")}
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t("api_keys.buttons.create")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};
