import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PropsWithChildren } from "react";

type FormCardGridProps = {
  title?: string;
} & PropsWithChildren<unknown>;

export default function FormCardGrid({ children, title }: FormCardGridProps) {
  return (
    <Card className="border-border/60 shadow-sm">
      {title && (
        <CardHeader className="py-2 px-4">
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="grid grid-cols-4 xs:grid-cols-1 gap-4 py-2 px-4">
        {children}
      </CardContent>
    </Card>
  );
}
