import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { useRefineContext, useResource } from "@refinedev/core";
import { Edit, Trash2 } from "lucide-react";
import {
  type FC,
  type HTMLAttributes,
  isValidElement,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppBreadcrumbs } from "@/foundation/components/AppBreadcrumbs";
import { PageHeader } from "@/foundation/components/PageHeader";
import { DeleteAction, EditAction } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { DeleteProvider } from "@/foundation/providers/delete-provider";

const Row = ({
  title,
  children,
}: Required<
  PropsWithChildren<{
    title: string;
  }>
>) => {
  return (
    <dl className="min-w-0">
      <div className="min-w-0">
        <dt className="text-xs font-medium leading-5 text-muted-foreground">
          {title}
        </dt>
        <dd className="mt-1 min-w-0 text-sm font-medium leading-6 text-foreground">
          {children}
        </dd>
      </div>
    </dl>
  );
};

const Section = ({
  title,
  description,
  children,
  className,
  contentClassName,
  framed = true,
  ...props
}: PropsWithChildren<{
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
  contentClassName?: string;
  framed?: boolean;
}> &
  HTMLAttributes<HTMLDivElement>) => (
  <div
    {...props}
    className={cn(
      framed ? "rounded-lg border bg-card shadow-sm" : "bg-transparent",
      className,
    )}
  >
    {(title || description) && (
      <div className={cn(framed ? "px-5 pt-4" : "pb-3")}>
        {title && (
          <h2 className="text-base font-semibold leading-6 text-foreground">
            {title}
          </h2>
        )}
        {description && (
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    )}
    <div className={cn(framed ? "p-5" : "", contentClassName)}>{children}</div>
  </div>
);

const SummaryItem = ({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) => (
  <div className="min-w-0">
    <div className="text-xs font-medium leading-5 text-muted-foreground">
      {label}
    </div>
    <div className="mt-1 min-w-0 truncate text-sm font-semibold leading-6 text-foreground">
      {value}
    </div>
  </div>
);

const Meta = ({
  label,
  children,
  className,
}: PropsWithChildren<{
  label: ReactNode;
  className?: string;
}>) => (
  <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
    <span className="shrink-0 text-sm font-semibold capitalize leading-6 text-muted-foreground/70 after:content-[':']">
      {label}
    </span>
    <span className="min-w-0 text-sm leading-6 text-foreground">
      {children}
    </span>
  </span>
);

const ObjectHeader = ({
  title,
  description,
  status,
  actions,
  children,
  className,
}: PropsWithChildren<{
  title: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
}>) => (
  <section className={cn("border-b pb-4", className)}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="min-w-0 truncate text-2xl font-semibold leading-8 text-foreground">
            {title}
          </h1>
          {status}
        </div>
        {description && (
          <div className="mt-1 max-w-4xl text-sm leading-6 text-foreground">
            {description}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
    {children && <div className="mt-3">{children}</div>}
  </section>
);

type ShowProps = {
  title?: React.ReactNode;
  resource?: string;
  breadcrumb?: React.ReactNode;
  canDelete?: boolean;
  canEdit?: boolean;
  extra?: React.ReactNode;
  record?: Record<string, any>;
  extraActions?: (record?: Record<string, any>) => React.ReactNode;
  showCurrentBreadcrumb?: boolean;
  children?: React.ReactNode;
};

export const ShowPage: FC<ShowProps> & {
  Row: typeof Row;
  Section: typeof Section;
  SummaryItem: typeof SummaryItem;
  Meta: typeof Meta;
  ObjectHeader: typeof ObjectHeader;
} = ({
  resource: resourceFromProps,
  breadcrumb: breadcrumbFromProps = null,
  canDelete = true,
  canEdit = true,
  extra,
  extraActions,
  record,
  showCurrentBreadcrumb = true,
  children,
}) => {
  const { t: translate } = useTranslation();
  const { options: { breadcrumb: globalBreadcrumb } = {} } = useRefineContext();

  const { resource } = useResource(resourceFromProps);

  const breadcrumb =
    typeof breadcrumbFromProps === "undefined"
      ? globalBreadcrumb
      : breadcrumbFromProps;

  return (
    <DeleteProvider>
      <PageHeader
        className="h-auto"
        breadcrumb={
          isValidElement(breadcrumb) ? (
            breadcrumb
          ) : (
            <div className="flex w-full justify-between items-center min-h-9">
              <AppBreadcrumbs
                record={record}
                showCurrent={showCurrentBreadcrumb}
              />
              {extra ? (
                extra
              ) : !canDelete && !canEdit ? null : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid="show-actions-trigger"
                    >
                      <DotsHorizontalIcon className="h-4 w-4" />
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-[160px]"
                    forceMount
                  >
                    {extraActions?.(record)}
                    {canEdit && (
                      <EditAction
                        title={translate("buttons.edit")}
                        row={record}
                        resource={resource?.name || ""}
                        icon={<Edit size={16} />}
                      />
                    )}
                    {canDelete && (
                      <DeleteAction
                        row={record}
                        resource={resource?.name ?? ""}
                        title={translate("buttons.delete")}
                        icon={<Trash2 size={16} />}
                      />
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )
        }
      />
      <div
        data-testid="show-page"
        className="relative !mt-0 grow overflow-auto pt-1"
      >
        {children}
      </div>
    </DeleteProvider>
  );
};

ShowPage.Row = Row;
ShowPage.Section = Section;
ShowPage.SummaryItem = SummaryItem;
ShowPage.Meta = Meta;
ShowPage.ObjectHeader = ObjectHeader;
ShowPage.displayName = "ShowPage";
