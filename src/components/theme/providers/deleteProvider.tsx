import { ConfirmDialog } from "@/components/theme/components/confirm";
import { useDeleteHelper, useOnBack } from "@/components/theme/hooks";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";
import type React from "react";
import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useState,
} from "react";

type DeleteDataType = {
  toogle: boolean;
  row: any;
  resource: string;
  redirectBack?: boolean;
  onAfterHandle?: () => void;
};

export interface DeleteContextType {
  data: DeleteDataType;
  updateData: (data: DeleteDataType) => void;
}

export function DeleteActionModal(props: DeleteContextType) {
  const back = useOnBack();
  const { can, isLoading, mutate } = useDeleteHelper(
    props.data?.resource,
    props.data?.row?.metadata.name,
    props.data?.row?.metadata,
  );

  const { t } = useTranslation();
  const [forceDelete, setForceDelete] = useState(false);

  const onDelete = useCallback(() => {
    if (can) {
      return mutate({
        meta: forceDelete ? { forceDelete: true } : undefined,
        onSuccess() {
          const isRedirectBack = props?.data?.redirectBack ?? false;
          const onAfterHandle = props?.data?.onAfterHandle;
          props?.updateData({
            toogle: false,
            row: undefined,
            resource: "",
            redirectBack: false,
            onAfterHandle: undefined,
          });
          setForceDelete(false);

          if (isRedirectBack) {
            back?.();
          }

          if (onAfterHandle) {
            onAfterHandle();
          }
        },
      });
    }

    return undefined;
  }, [can, props, back, mutate, forceDelete]);

  const errorMessage = props.data?.row?.status?.error_message;

  return (
    <ConfirmDialog
      open={can && props?.data?.toogle}
      loading={isLoading}
      title={t("dialogs.delete.title")}
      description={t("dialogs.delete.description")}
      okText={t("buttons.delete")}
      cancelText={t("buttons.cancel")}
      okButtonVariant={"destructive"}
      onOpenChange={() => {
        if (!isLoading) {
          props?.updateData({
            toogle: false,
            row: undefined,
            resource: "",
          });
          setForceDelete(false);
        }
      }}
      onConfirm={onDelete}
      content={
        <div className="space-y-4">
          {errorMessage && (
            <div className="rounded-md bg-destructive/10 p-3 max-h-40 overflow-y-auto">
              <div className="text-sm font-medium text-destructive mb-1">
                {t("dialogs.delete.currentError")}
              </div>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                {errorMessage}
              </pre>
            </div>
          )}
          <div className="flex items-start space-x-3">
            <Checkbox
              id="force-delete"
              checked={forceDelete}
              onCheckedChange={(checked) => setForceDelete(checked === true)}
            />
            <label
              htmlFor="force-delete"
              className="text-sm leading-none cursor-pointer"
            >
              <div className="font-medium mb-1">
                {t("dialogs.delete.forceDelete.label")}
              </div>
              <div className="text-muted-foreground">
                {t("dialogs.delete.forceDelete.description")}
              </div>
            </label>
          </div>
        </div>
      }
    />
  );
}

const DeleteContext = createContext<DeleteContextType | undefined>(undefined);

const DeleteProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [data, setData] = useState<DeleteDataType>({
    row: undefined,
    resource: "",
    toogle: false,
    onAfterHandle: undefined,
  });

  const updateData = (data: DeleteDataType) => {
    setData(data);
  };

  return (
    <DeleteContext.Provider value={{ data, updateData }}>
      {children}
      <DeleteActionModal
        data={data as DeleteDataType}
        updateData={updateData}
      />
    </DeleteContext.Provider>
  );
};

export { DeleteContext, DeleteProvider };
