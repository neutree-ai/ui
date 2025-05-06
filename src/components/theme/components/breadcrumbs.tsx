import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  matchResourceFromRoute,
  useBreadcrumb,
  useRefineContext,
  useResource,
} from "@refinedev/core";
import type { RefineBreadcrumbProps } from "@refinedev/ui-types";
import { type FC, Fragment } from "react";
import { Link } from "./link";
import { HomeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
export type BreadcrumbProps = RefineBreadcrumbProps & {
  record?: Record<string, any>;
};

export const Breadcrumbs: FC<BreadcrumbProps> = ({
  showHome = false,
  meta,
  record,
}) => {
  const { breadcrumbs } = useBreadcrumb({
    meta,
  });

  const { hasDashboard } = useRefineContext();

  const { resources } = useResource();

  const dashboardResource = resources[0];

  const rootRouteResource = matchResourceFromRoute("/", resources);

  const BreadCrumbItems = breadcrumbs.map(({ label: baseLabel, href }, key) => {
    let label = baseLabel;
    if (!href && baseLabel.toLowerCase() === "show" && record?.metadata?.name) {
      label = record?.metadata?.name;
    }

    return (
      <Fragment key={key}>
        <BreadcrumbItem>
          {href ? (
            <BreadcrumbLink asChild href={`#x`}>
              <Link href={href}>{label}</Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage
              className={cn(key === breadcrumbs.length - 1 && "font-bold")}
            >
              {label}
            </BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {key < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
      </Fragment>
    );
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {showHome || hasDashboard || rootRouteResource.found ? (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink
                href={dashboardResource.list?.toString()}
                asChild
                title={
                  dashboardResource?.meta?.title ??
                  dashboardResource.name ??
                  "Dashboard"
                }
              >
                <Link
                  href={dashboardResource.list?.toString()}
                  title={
                    dashboardResource?.meta?.title ??
                    dashboardResource.name ??
                    "Dashboard"
                  }
                >
                  {dashboardResource?.meta?.icon ?? (
                    <HomeIcon className="h-4 w-4" />
                  )}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        ) : null}
        {BreadCrumbItems}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
