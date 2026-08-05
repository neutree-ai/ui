import { useGo, useResource, useResourceParams } from "@refinedev/core";
import { useForm } from "react-hook-form";
import { Combobox } from "@/components/ui/combobox";
import { Form } from "@/components/ui/form";
import {
  ALL_WORKSPACES,
  useWorkspace,
  useWorkspaceSearch,
} from "@/foundation/hooks/use-workspace";
import { useTranslation } from "@/foundation/lib/i18n";

export default function WorkspaceSelect() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const { options, onSearchChange } = useWorkspaceSearch();
  const form = useForm({
    mode: "all",
    defaultValues: {
      value: current,
    },
  });
  const { resource } = useResource();
  const { action } = useResourceParams();
  const go = useGo();

  if (resource?.meta?.workspaced && action === "show") {
    return (
      <div className="flex h-9 max-w-[360px] min-w-0 items-center gap-2 text-sm">
        <span className="shrink-0 font-semibold text-muted-foreground/80">
          {t("common.fields.workspace")}:
        </span>
        <span className="min-w-0 truncate text-base font-semibold text-foreground">
          {current}
        </span>
      </div>
    );
  }

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
          ...options,
        ]}
        shouldFilter={false}
        onSearchChange={onSearchChange}
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
