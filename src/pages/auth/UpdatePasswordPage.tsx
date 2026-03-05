import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/foundation/lib/utils";
import {
  useActiveAuthProvider,
  useTranslate,
  useUpdatePassword,
} from "@refinedev/core";
import type { UpdatePasswordFormTypes } from "@refinedev/core";
import type React from "react";
import { toast } from "sonner";
import { ThemedTitle } from "./ThemedTitle";
import { validatePasswordMatch } from "./lib/validate-password-match";

type UpdatePasswordPageProps = {
  contentProps?: React.HTMLAttributes<HTMLDivElement>;
  wrapperProps?: React.HTMLAttributes<HTMLDivElement>;
  renderContent?: (
    content: React.ReactNode,
    title: React.ReactNode,
  ) => React.ReactNode;
  formProps?: React.ComponentProps<"form">;
  title?: React.ReactNode;
  mutationVariables?: Partial<UpdatePasswordFormTypes>;
};

export const UpdatePasswordPage: React.FC<UpdatePasswordPageProps> = ({
  contentProps,
  wrapperProps,
  renderContent,
  formProps,
  title,
  mutationVariables,
}) => {
  const translate = useTranslate();
  const authProvider = useActiveAuthProvider();
  const { mutate: updatePassword, isLoading } =
    useUpdatePassword<UpdatePasswordFormTypes>({
      v3LegacyAuthProviderCompatible: Boolean(authProvider?.isLegacy),
    });

  const PageTitle =
    title === false ? null : (
      <div className="flex justify-center mb-8 text-xl">
        {title ?? <ThemedTitle collapsed={false} />}
      </div>
    );

  const Content = (
    <Card
      className={cn("w-full max-w-md", contentProps?.className)}
      {...contentProps}
    >
      <CardHeader className="pb-0 pt-6">
        <CardTitle className="text-center text-2xl font-bold text-[hsl(var(--foreground))]">
          {translate("pages.updatePassword.title", "Set New Password")}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-8 pt-6 pb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const password = data.get("password") as string;
            const confirmPassword = data.get("confirmPassword") as string;

            if (!validatePasswordMatch(password, confirmPassword)) {
              toast.error(
                translate(
                  "pages.auth.errors.confirmPasswordNotMatch",
                  "Passwords do not match",
                ),
              );
              return;
            }

            updatePassword({
              password,
              confirmPassword,
              ...mutationVariables,
            });
          }}
          {...formProps}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">
                {translate(
                  "pages.updatePassword.fields.password",
                  "New Password",
                )}
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder={translate("pages.auth.passwordPlaceholder")}
                required
                minLength={6}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                {translate(
                  "pages.updatePassword.fields.confirmPassword",
                  "Confirm New Password",
                )}
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder={translate("pages.auth.passwordPlaceholder")}
                required
                className="h-10"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-10 mt-4"
              disabled={isLoading}
            >
              {isLoading
                ? translate("pages.auth.loading", "Loading...")
                : translate("pages.updatePassword.buttons.submit", "Update")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  return (
    <div
      className={cn(
        "w-full flex justify-center items-start pt-8",
        wrapperProps?.className,
      )}
      {...wrapperProps}
    >
      <div
        className={cn(
          "w-full flex flex-col items-center justify-start max-w-md",
        )}
      >
        {renderContent ? renderContent(Content, PageTitle) : <>{Content}</>}
      </div>
    </div>
  );
};
