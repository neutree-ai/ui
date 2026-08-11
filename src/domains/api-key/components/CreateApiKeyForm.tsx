import {
  useCustomMutation,
  useInvalidate,
  useList,
  useSelect,
} from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { Check, Copy, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { FieldValues } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiKeyPolicyFields } from "@/domains/api-key/components/ApiKeyPolicyFields";
import {
  type ApiKeyPolicyFormValues,
  apiKeyPolicyDefaults,
  buildApiKeyLimits,
} from "@/domains/api-key/hooks/use-api-key-policy";
import type { ApiKey, Project } from "@/domains/api-key/types";
import { FormCombobox } from "@/foundation/components/FormCombobox";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { useCopyToClipboard } from "@/foundation/hooks/use-copy-to-clipboard";

type FormValues = {
  name: string;
  description: string;
  workspace: string;
  project_id: string;
} & ApiKeyPolicyFormValues;

export const CreateApiKeyForm = ({ onClose }: { onClose?: () => void }) => {
  const { t } = useTranslation();
  const form = useForm<FormValues>({
    mode: "all",
    defaultValues: {
      name: "",
      description: "",
      workspace: "",
      project_id: "",
      ...apiKeyPolicyDefaults(),
    },
  });
  const selectedWorkspace = form.watch("workspace");
  const workspaces = useSelect({
    resource: "workspaces",
  });
  const [apiKey, setApiKey] = useState<ApiKey | null>(null);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectError, setProjectError] = useState<string | null>(null);
  const { copy, copied } = useCopyToClipboard();

  const { mutateAsync } = useCustomMutation();
  const invalidate = useInvalidate();
  const projects = useList<Project>({
    resource: "projects",
    pagination: { mode: "off" },
    filters: selectedWorkspace
      ? [{ field: "workspace", operator: "eq", value: selectedWorkspace }]
      : [],
    queryOptions: { enabled: Boolean(selectedWorkspace) },
  });

  useEffect(() => {
    if (!selectedWorkspace) form.setValue("project_id", "");
  }, [selectedWorkspace, form]);

  const handleCopy = (text: string) =>
    copy(text, {
      successMessage: t("components.apiKey.copySuccess"),
      successDescription: t("components.apiKey.copySuccessDescription"),
      errorMessage: t("components.apiKey.errors.copyFailed"),
    });

  const onSubmit = async (formValue: FieldValues) => {
    // Create with limits in one atomic call — quota + access live on the key's
    // spec.limits, so create_api_key takes the whole limits object.
    const { data } = await mutateAsync({
      url: "/rpc/create_api_key",
      method: "post",
      values: {
        p_workspace: formValue.workspace,
        p_name: formValue.name,
        p_quota: 0,
        p_project_id: formValue.project_id || null,
        p_description: formValue.description || null,
        p_limits: buildApiKeyLimits(formValue as ApiKeyPolicyFormValues),
      },
    });
    invalidate({
      resource: "api_keys",
      invalidates: ["list"],
    });
    setApiKey(data as ApiKey);
  };

  const createProject = async () => {
    if (!projectName.trim() || !selectedWorkspace) {
      setProjectError(t("common.validation.required"));
      return;
    }
    setProjectError(null);
    try {
      const { data } = await mutateAsync({
        url: "/rpc/create_project",
        method: "post",
        values: {
          p_workspace: selectedWorkspace,
          p_name: projectName.trim(),
          p_description: projectDescription.trim() || null,
        },
      });
      const created = data as Project;
      await projects.refetch();
      form.setValue("project_id", created.id, { shouldValidate: true });
      setProjectFormOpen(false);
      setProjectName("");
      setProjectDescription("");
    } catch (error) {
      setProjectError(
        error instanceof Error
          ? error.message
          : t("api_keys.errors.createFailed"),
      );
    }
  };

  if (apiKey) {
    return (
      <div className="space-y-4">
        <Alert className="border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {t("api_keys.messages.createSuccess")}
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <div className="text-sm font-medium">
            {t("api_keys.fields.secretKey")}:
          </div>
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
            disabled={workspaces.query.isLoading}
            options={(workspaces.query.data?.data || []).map((e) => ({
              label: e.metadata.name,
              value: e.metadata.name,
            }))}
          />
        </FormFieldGroup>
        <FormFieldGroup {...form} name="project_id" label="Project">
          <FormCombobox
            placeholder="Select Project"
            disabled={!selectedWorkspace || projects.isLoading}
            options={[
              ...(projects.data?.data ?? [])
                .filter((project) => project.status === "enabled")
                .map((project) => ({ label: project.name, value: project.id })),
            ]}
          />
        </FormFieldGroup>
        {selectedWorkspace && !projectFormOpen && (
          <Button
            type="button"
            variant="link"
            className="h-auto px-0"
            onClick={() => setProjectFormOpen(true)}
          >
            + Create Project
          </Button>
        )}
        {projectFormOpen && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Create Project</div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setProjectFormOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Name"
              autoFocus
            />
            <Textarea
              value={projectDescription}
              onChange={(event) => setProjectDescription(event.target.value)}
              placeholder="Description"
            />
            {projectError && (
              <p className="text-sm text-destructive">{projectError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setProjectFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => void createProject()}>
                Create and select
              </Button>
            </div>
          </div>
        )}
        <FormFieldGroup {...form} name="name" label={t("common.fields.name")}>
          <Input />
        </FormFieldGroup>
        <FormFieldGroup {...form} name="description" label="Description">
          <Textarea />
        </FormFieldGroup>

        <div className="pt-1 text-sm font-medium">
          {t("api_keys.limits.sectionTitle")}
        </div>
        <ApiKeyPolicyFields form={form} workspace={selectedWorkspace} />

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
