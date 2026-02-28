import { Combobox } from "@/components/ui/combobox";
import { Form } from "@/components/ui/form";
import { ALL_WORKSPACES, useWorkspace } from "@/foundation/hooks";
import { useTranslation } from "@/foundation/lib/i18n";
import { useGo, useResource, useResourceParams } from "@refinedev/core";
import { useForm } from "react-hook-form";

export default function WorkspaceSelect() {
  const { t } = useTranslation();
  const { current, data } = useWorkspace();
  const form = useForm({
    mode: "all",
    defaultValues: {
      value: current,
    },
  });
  const { resource } = useResource();
  const { action } = useResourceParams();
  const go = useGo();

  if (!resource?.meta?.workspaced || action !== "list") {
    return null;
  }

  return (
    <Form {...form}>
      <Combobox
        options={[
          {
            label: t("workspaces.options.allWorkspaces"),
            value: ALL_WORKSPACES,
          },
        ].concat(
          data.map((workspace) => ({
            label: workspace.metadata.name,
            value: workspace.metadata.name,
          })),
        )}
        triggerClassName="w-[280px]"
        placeholder={t("workspaces.placeholders.selectWorkspace")}
        value={current}
        allowUnselect={false}
        onChange={(value) => {
          const to = resource?.list
            ?.toString()
            .replace("/:workspace/", `/${value}/`);
          go({
            to,
            type: "push",
          });
        }}
      />
    </Form>
  );
}
