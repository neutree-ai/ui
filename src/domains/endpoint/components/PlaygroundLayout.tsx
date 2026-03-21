import type { ReactNode } from "react";

type PlaygroundLayoutProps = {
  title: string;
  actions: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
};

export function PlaygroundLayout({
  title,
  actions,
  sidebar,
  children,
}: PlaygroundLayoutProps) {
  return (
    <div className="h-full overflow-auto">
      <div className="h-full flex-col">
        <div className="container h-full py-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">{title}</h2>
            <div className="flex items-center space-x-2">{actions}</div>
          </div>
          <div className="grid h-full items-stretch gap-6 md:grid-cols-[1fr_300px]">
            <div className="flex-col space-y-4 sm:flex md:order-2">
              {sidebar}
            </div>
            <div className="md:order-1 space-y-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
