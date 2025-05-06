import type React from "react";
import {
  useUpdatePassword,
  useTranslate,
  useActiveAuthProvider,
} from "@refinedev/core";
import type { UpdatePasswordFormTypes } from "@refinedev/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ThemedTitle } from "./ThemedTitle";
import { authStyles } from "./styles";

type UpdatePasswordPageProps = {
  contentProps?: React.HTMLAttributes<HTMLDivElement>;
  wrapperProps?: React.HTMLAttributes<HTMLDivElement>;
  renderContent?: (
    content: React.ReactNode,
    title: React.ReactNode
  ) => React.ReactNode;
  formProps?: React.ComponentProps<"form">;
  title?: React.ReactNode;
  mutationVariables?: any;
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

            if (password !== confirmPassword) {
              alert(
                translate(
                  "pages.updatePassword.errors.confirmPasswordNotMatch",
                  "Passwords do not match"
                )
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
                  "New Password"
                )}
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="●●●●●●●●"
                required
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                {translate(
                  "pages.updatePassword.fields.confirmPassword",
                  "Confirm New Password"
                )}
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="●●●●●●●●"
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
                ? "Loading..."
                : translate("pages.updatePassword.buttons.submit", "Update")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  return (
    <div
      className={cn(authStyles.container, wrapperProps?.className)}
      {...wrapperProps}
    >
      <div className="w-full flex flex-col items-center justify-center px-4 py-12">
        {renderContent ? (
          renderContent(Content, PageTitle)
        ) : (
          <>
            {PageTitle}
            {Content}
          </>
        )}
      </div>
    </div>
  );
};
