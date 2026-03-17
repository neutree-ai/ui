import { useResource, useUserFriendlyName } from "@refinedev/core";
import type { FC } from "react";
import { CreateButton } from "@/foundation/components/CreateButton";
import { PageHeader } from "@/foundation/components/PageHeader";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";

type ListProps = {
  title?: React.ReactNode;
  resource?: string;
  breadcrumb?: React.ReactNode;
  createButtonProps?: Partial<React.ComponentProps<typeof CreateButton>>;
  className?: string;
  canCreate?: boolean;
  extra?: React.ReactNode;
  children?: React.ReactNode;
};

export const ListPage: FC<ListProps> = ({
  title,
  resource: resourceFromProps,
  breadcrumb: breadcrumbFromProps,
  createButtonProps,
  className,
  canCreate = true,
  extra,
  children,
}) => {
  const { t: translate } = useTranslation();
  const getUserFriendlyName = useUserFriendlyName();

  const { resource, identifier } = useResource(resourceFromProps);

  return (
    <>
      <PageHeader
        title={
          title ??
          translate(
            `${identifier}.title`,
            `List ${getUserFriendlyName(
              resource?.meta?.label ?? identifier,
              "plural",
            )}`,
          )
        }
        breadcrumb={null}
        extra={
          extra ?? (
            <div className="inline-flex flex-row gap-4">
              {canCreate && (
                <CreateButton
                  {...createButtonProps}
                  resource={createButtonProps?.resource ?? identifier}
                />
              )}
            </div>
          )
        }
      />
      <div
        data-testid="list-page"
        className={cn("pt-2 sm:pt-4 !mt-0", className)}
      >
        {children}
      </div>
    </>
  );
};

ListPage.displayName = "ListPage";
