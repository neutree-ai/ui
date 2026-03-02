import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ModelMappingEditor from "@/domains/external-endpoint/components/ModelMappingEditor";
import { cleanUpstreamsForSubmit } from "@/domains/external-endpoint/lib/clean-upstreams-for-submit";
import type {
  ExternalEndpoint,
  UpstreamSpec,
} from "@/domains/external-endpoint/types";
import FormCardGrid from "@/foundation/components/FormCardGrid";
import { FormFieldGroup } from "@/foundation/components/FormFieldGroup";
import { FormSelect } from "@/foundation/components/FormSelect";
import WorkspaceField from "@/foundation/components/WorkspaceField";
import { useWorkspace } from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";
import { useForm } from "@refinedev/react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { useFieldArray } from "react-hook-form";

const emptyUpstream: UpstreamSpec = {
  upstream: { url: "" },
  auth: { type: "bearer", credential: "" },
  model_mapping: {},
  models: null,
};

export const useExternalEndpointForm = ({
  action,
}: {
  action: "create" | "edit";
}) => {
  const { t } = useTranslation();
  const { current: currentWorkspace } = useWorkspace();
  const form = useForm<ExternalEndpoint>({
    mode: "all",
    defaultValues: {
      api_version: "v1",
      kind: "ExternalEndpoint",
      metadata: {
        name: "",
        workspace: currentWorkspace,
      },
      spec: {
        route_type: "/v1/chat/completions",
        timeout: 300,
        upstreams: [{ ...emptyUpstream }],
      },
    },
    refineCoreProps: {},
    warnWhenUnsavedChanges: true,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "spec.upstreams",
  });

  const isEdit = action === "edit";

  const originalOnFinish = form.refineCore.onFinish;
  form.refineCore.onFinish = async (values) => {
    const v = values as ExternalEndpoint;
    if (v.spec?.upstreams) {
      v.spec.upstreams = cleanUpstreamsForSubmit(v.spec.upstreams, isEdit);
    }
    return originalOnFinish(v);
  };

  return {
    form,
    metadataFields: (
      <FormCardGrid title={t("common.sections.basicInformation")}>
        <FormFieldGroup
          {...form}
          label={t("common.fields.name")}
          {...form.register("metadata.name", {
            required: {
              value: true,
              message: t("external_endpoints.validation.nameRequired"),
            },
          })}
        >
          <Input
            placeholder={t("external_endpoints.placeholders.endpointName")}
            disabled={isEdit}
          />
        </FormFieldGroup>
        <FormFieldGroup
          {...form}
          name="metadata.workspace"
          label={t("common.fields.workspace")}
        >
          <WorkspaceField disabled={isEdit} />
        </FormFieldGroup>
      </FormCardGrid>
    ),
    specFields: (
      <>
        {fields.map((field, index) => (
          <Card key={field.id} className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between py-2 px-4">
              <CardTitle>
                {t("external_endpoints.sections.upstream", {
                  index: index + 1,
                })}
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                disabled={fields.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 py-2 px-4">
              <div className="grid grid-cols-4 xs:grid-cols-1 gap-4">
                <FormFieldGroup
                  {...form}
                  label={t("external_endpoints.fields.upstreamUrl")}
                  {...form.register(`spec.upstreams.${index}.upstream.url`, {
                    required: {
                      value: true,
                      message: t(
                        "external_endpoints.validation.upstreamUrlRequired",
                      ),
                    },
                  })}
                >
                  <Input
                    placeholder={t(
                      "external_endpoints.placeholders.upstreamUrl",
                    )}
                  />
                </FormFieldGroup>
                <FormFieldGroup
                  {...form}
                  name={`spec.upstreams.${index}.auth.type`}
                  label={t("external_endpoints.fields.authType")}
                >
                  <FormSelect
                    placeholder={t(
                      "external_endpoints.placeholders.selectAuthType",
                    )}
                    options={[
                      { label: "Bearer", value: "bearer" },
                      { label: "Basic", value: "basic" },
                    ]}
                  />
                </FormFieldGroup>
                <FormFieldGroup
                  {...form}
                  name={`spec.upstreams.${index}.auth.credential`}
                  label={t("external_endpoints.fields.credential")}
                  description={
                    isEdit
                      ? t("common.messages.leaveEmptyToKeepValue")
                      : undefined
                  }
                  className="col-span-2"
                >
                  <Input
                    type="password"
                    placeholder={t(
                      "external_endpoints.placeholders.credential",
                    )}
                  />
                </FormFieldGroup>
              </div>
              <div>
                <FormFieldGroup
                  {...form}
                  name={`spec.upstreams.${index}.model_mapping`}
                  label={t("external_endpoints.fields.modelMapping")}
                  className="col-span-4"
                >
                  <ModelMappingEditor />
                </FormFieldGroup>
              </div>
            </CardContent>
          </Card>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => append({ ...emptyUpstream })}
          className="w-full"
        >
          <Plus className="mr-1 h-4 w-4" />
          {t("external_endpoints.actions.addUpstream")}
        </Button>
      </>
    ),
  };
};
