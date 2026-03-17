import type { RegisterFormTypes } from "@refinedev/core";
import {
  type OAuthProvider,
  useActiveAuthProvider,
  useLink,
  useRegister,
  useRouterContext,
  useRouterType,
} from "@refinedev/core";
import type React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { authStyles } from "./styles";
import { ThemedTitle } from "./ThemedTitle";

type RegisterPageProps = {
  providers?: OAuthProvider[];
  loginLink?: React.ReactNode;
  contentProps?: React.HTMLAttributes<HTMLDivElement>;
  wrapperProps?: React.HTMLAttributes<HTMLDivElement>;
  renderContent?: (
    content: React.ReactNode,
    title: React.ReactNode,
  ) => React.ReactNode;
  formProps?: React.ComponentProps<"form">;
  title?: React.ReactNode;
  hideForm?: boolean;
  mutationVariables?: Partial<RegisterFormTypes>;
};

export const RegisterPage: React.FC<RegisterPageProps> = ({
  providers,
  loginLink,
  contentProps,
  wrapperProps,
  renderContent,
  formProps,
  title,
  hideForm,
  mutationVariables,
}) => {
  const { t: translate } = useTranslation();
  const routerType = useRouterType();
  const Link = useLink();
  const { Link: LegacyLink } = useRouterContext();
  const ActiveLink = routerType === "legacy" ? LegacyLink : Link;

  const authProvider = useActiveAuthProvider();
  const { mutate: register, isLoading } = useRegister<RegisterFormTypes>({
    v3LegacyAuthProviderCompatible: Boolean(authProvider?.isLegacy),
  });

  const PageTitle =
    title === false ? null : (
      <div className="flex justify-center mb-8 text-xl">
        {title ?? <ThemedTitle collapsed={false} />}
      </div>
    );

  const renderProviders = () => {
    if (providers && providers.length > 0) {
      return (
        <>
          {providers.map((provider) => (
            <Button
              key={provider.name}
              variant="outline"
              className="w-full mb-2 flex justify-center items-center"
              onClick={() =>
                register({
                  ...mutationVariables,
                  providerName: provider.name,
                })
              }
            >
              {provider.icon && <span className="mr-2">{provider.icon}</span>}
              {provider.label}
            </Button>
          ))}
          {!hideForm && (
            <div className="relative my-4">
              <Separator className="my-4">
                <span className="text-[hsl(var(--muted-foreground))] px-2">
                  {translate("pages.auth.divider")}
                </span>
              </Separator>
            </div>
          )}
        </>
      );
    }
    return null;
  };

  const Content = (
    <Card
      className={cn("w-full max-w-md", contentProps?.className)}
      {...contentProps}
    >
      <CardHeader className="pb-0 pt-6">
        <CardTitle className="text-center text-2xl font-bold text-[hsl(var(--foreground))]">
          {translate("pages.register.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-8 pt-6">
        {renderProviders()}
        {!hideForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              register({
                email: data.get("email") as string,
                password: data.get("password") as string,
                ...mutationVariables,
              });
            }}
            {...formProps}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">
                  {translate("common.fields.email")}
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={translate("pages.auth.emailPlaceholder")}
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  {translate("common.fields.password")}
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
              <Button
                type="submit"
                className="w-full h-10 mt-4"
                disabled={isLoading}
              >
                {isLoading
                  ? translate("pages.auth.loading")
                  : translate("pages.register.buttons.submit")}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
      <CardFooter className="pb-6 px-8 flex justify-center">
        {loginLink ?? (
          <div className="text-sm text-center">
            {translate("pages.register.buttons.haveAccount")}{" "}
            <ActiveLink
              to="/login"
              className="font-medium text-[hsl(var(--primary))] hover:underline"
            >
              {translate("pages.auth.signIn")}
            </ActiveLink>
          </div>
        )}
      </CardFooter>
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
