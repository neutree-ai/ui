import { useCreate, useInvalidate } from "@refinedev/core";
import { BookmarkPlus } from "lucide-react";
import { createContext, type ReactNode, useContext, useState } from "react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { buildCatalogFromEndpoint } from "@/domains/endpoint/lib/save-as-catalog";
import type { Endpoint } from "@/domains/endpoint/types";
import { RowAction, type RowActionProps } from "@/foundation/components/Table";
import {
  getErrorMessage,
  isDuplicateNameError,
} from "@/foundation/lib/error-message";
import { useTranslation } from "@/foundation/lib/i18n";

/**
 * Saves what an endpoint is running as a new model catalog.
 *
 * A separate action rather than a step of deploying, so it cannot half-succeed
 * alongside a deployment, and so a user who may run endpoints but not write
 * catalogs is refused here rather than mid-deploy. It always creates: writing
 * back into the catalog an endpoint came from is what this deliberately
 * replaces — see `buildCatalogFromEndpoint`.
 */

type SaveAsCatalogContextValue = {
  openSaveAsCatalog: (endpoint: Endpoint) => void;
};

const SaveAsCatalogContext = createContext<SaveAsCatalogContextValue | null>(
  null,
);

/**
 * Renders the dialog outside any dropdown. The action itself lives inside the
 * row/page menu, and a dialog mounted there is dismissed by the same click
 * that closes the menu — so the state is held here and the dialog rendered as
 * a sibling of the page. Wrap the list and show pages with this.
 */
export function EndpointSaveAsCatalogProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <SaveAsCatalogContext.Provider
      value={{
        openSaveAsCatalog: (next) => {
          setEndpoint(next);
          setOpen(true);
        },
      }}
    >
      {children}
      {endpoint && (
        <SaveAsCatalogDialog
          // Remounting per endpoint is what re-seeds the name field, so opening
          // the dialog on a second endpoint does not offer the first one's name.
          key={endpoint.metadata.name}
          endpoint={endpoint}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </SaveAsCatalogContext.Provider>
  );
}

type EndpointSaveAsCatalogActionProps = RowActionProps & {
  endpoint: Endpoint;
};

/** Menu item that opens the dialog through the provider. Safe inside dropdown
 * content — no dialog lives here. */
export const EndpointSaveAsCatalogAction = ({
  endpoint,
  title,
  disabled,
  icon,
  ...props
}: EndpointSaveAsCatalogActionProps) => {
  const { t } = useTranslation();
  const context = useContext(SaveAsCatalogContext);

  return (
    <RowAction
      {...props}
      icon={icon ?? <BookmarkPlus size={16} />}
      title={title ?? t("endpoints.actions.saveAsCatalog")}
      disabled={disabled || !context}
      onClick={() => context?.openSaveAsCatalog(endpoint)}
    />
  );
};

EndpointSaveAsCatalogAction.displayName = "EndpointSaveAsCatalogAction";

function SaveAsCatalogDialog({
  endpoint,
  open,
  onOpenChange,
}: {
  endpoint: Endpoint;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const { mutateAsync, isLoading } = useCreate();
  const [name, setName] = useState(endpoint.metadata.name);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || isLoading) return;

    try {
      await mutateAsync({
        resource: "model_catalogs",
        values: buildCatalogFromEndpoint(endpoint, trimmed),
        meta: {
          idColumnName: "metadata->name",
          workspace: endpoint.metadata.workspace ?? "",
          workspaced: true,
        },
        successNotification: false,
        errorNotification: false,
      });

      toast.success(
        t("endpoints.messages.saveAsCatalogSuccess", { name: trimmed }),
      );
      onOpenChange(false);
      await invalidate({ resource: "model_catalogs", invalidates: ["list"] });
    } catch (error) {
      // The dialog stays open on every failure: the name is the one thing the
      // user typed, and a duplicate is fixed by editing it.
      toast.error(
        isDuplicateNameError(error)
          ? t("endpoints.messages.saveAsCatalogDuplicate", { name: trimmed })
          : getErrorMessage(error, t("endpoints.messages.saveAsCatalogFailed")),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="endpoint-save-as-catalog-dialog">
        <DialogHeader>
          <DialogTitle>{t("endpoints.saveAsCatalog.title")}</DialogTitle>
          <DialogDescription>
            {t("endpoints.saveAsCatalog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="save-as-catalog-name">
            {t("endpoints.saveAsCatalog.nameLabel")}
          </Label>
          <Input
            id="save-as-catalog-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {t("buttons.cancel")}
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={isLoading || !name.trim()}
          >
            {t("endpoints.saveAsCatalog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
