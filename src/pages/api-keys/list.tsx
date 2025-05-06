import { ListPage, ShowButton, Table, Combobox } from "@/components/theme";
import { Edit, Trash2 } from "lucide-react";
import type { UseTableReturnType } from "@refinedev/react-table";
import {
  BaseRecord,
  HttpError,
  useCustomMutation,
  useInvalidate,
  useSelect,
  useUserFriendlyName,
} from "@refinedev/core";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { useForm } from "@refinedev/react-hook-form";
import { useMetadataColumns } from "@/components/theme/table/columns/metadata-columns";
import { useApiKeyColumns } from "@/components/theme/table/columns/api-key-columns";

const CreateApiKeyForm = ({ onClose }: { onClose?: () => void }) => {
  const form = useForm({
    mode: "all",
    defaultValues: {
      name: "",
      workspace: "",
    },
  });
  const workspaces = useSelect({
    resource: "workspaces",
  });
  // TODO: use defined types
  const [apiKey, setApiKey] = useState<any>(null);

  const { mutateAsync } = useCustomMutation();
  const invalidate = useInvalidate();

  const onSubmit = async (formValue: { name: string; workspace: string }) => {
    const { data } = await mutateAsync({
      url: `/rpc/create_api_key`,
      method: "post",
      values: {
        p_workspace: formValue.workspace,
        p_name: formValue.name,
        p_quota: 0,
      },
    });
    invalidate({
      resource: "api_keys",
      invalidates: ["list"],
    });
    setApiKey(data);
  };

  if (apiKey) {
    return (
      <div>
        <div>Secret Key: {apiKey.status.sk_value}</div>
        <Button onClick={onClose}>Close</Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        <FormField
          name="workspace"
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>Workspace</FormLabel>
                <FormControl>
                  <Combobox
                    placeholder="Select A Workspace"
                    disabled={workspaces.query.isLoading}
                    options={(workspaces.query.data?.data || []).map((e) => ({
                      label: e.metadata.name,
                      value: e.metadata.name,
                    }))}
                    {...field}
                  />
                </FormControl>
              </FormItem>
            );
          }}
        />
        <FormField
          name="name"
          render={({ field }) => {
            return (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </FormItem>
            );
          }}
        />
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            Create
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};

export const ApiKeysList = () => {
  const [open, setOpen] = useState(false);
  const metadataColumns = useMetadataColumns();
  const apiKeyColumns = useApiKeyColumns();

  return (
    <ListPage
      createButtonProps={{
        onClick: () => {
          setOpen(true);
        },
      }}
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for your application.
            </DialogDescription>
          </DialogHeader>
          <CreateApiKeyForm onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <Table enableSorting enableFilters>
        {metadataColumns.name}
        {metadataColumns.workspace}

        {metadataColumns.creation_timestamp}
        {apiKeyColumns.action}
      </Table>
    </ListPage>
  );
};
