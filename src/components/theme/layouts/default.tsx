import { ModeToggle, AppSidebar } from "@/components/theme/components";
import { cn } from "@/lib/utils";
import type { LayoutProps } from "@/components/theme/types";
import { BaseLayout } from "./base";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export const DefaultLayout = ({
  children,
  defaultLayout,
  defaultCollapsed = false,
  navCollapsedSize,
  navbar,
  footer,
  logo,
}: LayoutProps) => {
  return (
    <>
      <BaseLayout>
        <SidebarProvider className="h-full items-stretch">
          <AppSidebar logo={logo} />
          <div className="xl:max-h-dvh h-full !overflow-y-auto flex flex-col overflow-x-hidden grow">
            <header
              className={cn(
                "sticky top-0 z-50 py-2 h-14 px-2 flex justify-end items-center border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
                navbar?.rightSide && "justify-between",
              )}
            >
              <SidebarTrigger variant="outline" />
              <Separator orientation="vertical" className="mx-2" />
              {navbar?.leftSide && (
                <div className="flex items-center justify-start flex-1">
                  {navbar?.leftSide}
                </div>
              )}
              {navbar?.rightSide ? (
                <div className="flex items-center justify-end flex-1">
                  {<ModeToggle />}
                  {navbar?.rightSide}
                </div>
              ) : (
                <ModeToggle />
              )}
            </header>
            <main className="grow px-4 py-2 flex flex-col overflow-auto">
              {children}
            </main>
            {footer && (
              <footer className="px-6 py-4 border-t border-border/40 sticky bottom-0 bg-background text-primary flex flex-row items-center">
                <div className="w-full">{footer}</div>
              </footer>
            )}
          </div>
        </SidebarProvider>
      </BaseLayout>
    </>
  );
};

DefaultLayout.displayName = "DefaultLayout";
