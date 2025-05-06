import { useGo, useResource, useResourceParams } from "@refinedev/core";
import { Form } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { useForm } from "react-hook-form";
import { ALL_WORKSPACES, useWorkspace } from "../theme/hooks";

export default function WorkspaceSelect() {
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
            label: "All workspaces",
            value: ALL_WORKSPACES,
          },
        ].concat(
          data.map((workspace) => ({
            label: workspace.metadata.name,
            value: workspace.metadata.name,
          }))
        )}
        triggerClassName="w-[280px]"
        placeholder="Select a workspace"
        value={current}
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
