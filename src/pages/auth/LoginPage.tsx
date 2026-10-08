import type { LoginFormTypes } from "@refinedev/core";
import {
  useActiveAuthProvider,
  useLink,
  useLogin,
  useParsed,
  useRouterContext,
  useRouterType,
} from "@refinedev/core";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLoginIdentitySources } from "@/foundation/hooks/use-login-identity-sources";
import {
  buildOidcAuthorizeUrl,
  type LoginIdentitySource,
} from "@/foundation/lib/api/identity-sources";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  rememberPostLoginPath,
  ssoRedirectTarget,
} from "@/foundation/lib/sso-callback";
import { cn } from "@/foundation/lib/utils";
import type { LdapLoginParams } from "@/foundation/providers/auth-provider";
import { authStyles } from "./styles";
import { ThemedTitle } from "./ThemedTitle";

type LoginPageProps = {
  forgotPasswordLink?: React.ReactNode;
  rememberMe?: React.ReactNode;
  contentProps?: React.HTMLAttributes<HTMLDivElement>;
  wrapperProps?: React.HTMLAttributes<HTMLDivElement>;
  renderContent?: (
    content: React.ReactNode,
    title: React.ReactNode,
  ) => React.ReactNode;
  formProps?: React.ComponentProps<"form">;
  title?: React.ReactNode;
  mutationVariables?: Partial<LoginFormTypes>;
};

export const LoginPage: React.FC<LoginPageProps> = ({
  forgotPasswordLink,
  rememberMe,
  contentProps,
  wrapperProps,
  renderContent,
  formProps,
  title,
  mutationVariables,
}) => {
  const { t: translate } = useTranslation();
  const routerType = useRouterType();
  const Link = useLink();
  const { Link: LegacyLink } = useRouterContext();
  const ActiveLink = routerType === "legacy" ? LegacyLink : Link;

  const authProvider = useActiveAuthProvider();
  const { mutate: login, isLoading } = useLogin<
    LoginFormTypes | LdapLoginParams
  >({
    v3LegacyAuthProviderCompatible: Boolean(authProvider?.isLegacy),
  });

  const PageTitle =
    title === false ? null : (
      <div className="flex flex-col items-center">
        <div className="flex justify-center mb-8 text-xl">
          {title ?? <ThemedTitle collapsed={false} />}
        </div>
      </div>
    );

  const { params } = useParsed<{ to?: string }>();
  const { ldapSources, oidcSources } = useLoginIdentitySources();

  const startOidcLogin = (source: LoginIdentitySource) => {
    rememberPostLoginPath(params?.to);
    window.location.assign(
      buildOidcAuthorizeUrl(source.name, ssoRedirectTarget()),
    );
  };

  const localForm = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        login({
          email: data.get("email") as string,
          password: data.get("password") as string,
          remember: data.get("remember") === "on",
          ...mutationVariables,
        });
      }}
      {...formProps}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">
            {translate("pages.login.fields.identifier")}
          </Label>
          <Input
            id="email"
            name="email"
            type="text"
            placeholder={translate("pages.login.fields.identifierPlaceholder")}
            required
            className="h-10"
            autoComplete="username email"
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
            className="h-10"
            autoComplete="current-password"
          />
        </div>
        <div className="flex items-center justify-between">
          {rememberMe ?? (
            <div className="flex items-center space-x-2">
              <Checkbox id="remember" name="remember" />
              <Label htmlFor="remember" className="text-sm font-normal">
                {translate("pages.login.buttons.rememberMe")}
              </Label>
            </div>
          )}
          {forgotPasswordLink ?? (
            <ActiveLink
              className="text-sm font-medium text-[hsl(var(--primary))] hover:underline ml-auto"
              to="/forgot-password"
            >
              {translate("pages.login.buttons.forgotPassword")}
            </ActiveLink>
          )}
        </div>
        <Button type="submit" className="w-full h-10" disabled={isLoading}>
          {isLoading
            ? translate("pages.auth.loading")
            : translate("pages.auth.signIn")}
        </Button>
      </div>
    </form>
  );

  const ldapForm = (source: LoginIdentitySource) => (
    <form
      data-testid={`ldap-login-form-${source.name}`}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        login({
          method: "ldap",
          source: source.name,
          username: data.get("username") as string,
          password: data.get("password") as string,
        });
      }}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`ldap-username-${source.name}`}>
            {translate("pages.login.fields.directoryUsername")}
          </Label>
          <Input
            id={`ldap-username-${source.name}`}
            name="username"
            type="text"
            placeholder={translate(
              "pages.login.fields.directoryUsernamePlaceholder",
            )}
            required
            className="h-10"
            autoComplete="username"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`ldap-password-${source.name}`}>
            {translate("common.fields.password")}
          </Label>
          <Input
            id={`ldap-password-${source.name}`}
            name="password"
            type="password"
            placeholder={translate("pages.auth.passwordPlaceholder")}
            required
            className="h-10"
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" className="w-full h-10" disabled={isLoading}>
          {isLoading
            ? translate("pages.auth.loading")
            : translate("pages.auth.signIn")}
        </Button>
      </div>
    </form>
  );

  // One tree whether or not the sources have loaded yet: the local form keeps
  // its place (and what the user typed) when the LDAP tabs appear.
  const passwordForms = (
    <Tabs defaultValue="local">
      {ldapSources.length > 0 && (
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="local" className="flex-1">
            {translate("pages.login.tabs.local")}
          </TabsTrigger>
          {ldapSources.map((source) => (
            <TabsTrigger
              key={source.name}
              value={`ldap:${source.name}`}
              className="flex-1"
            >
              {source.display_name}
            </TabsTrigger>
          ))}
        </TabsList>
      )}
      <TabsContent value="local" className="mt-0">
        {localForm}
      </TabsContent>
      {ldapSources.map((source) => (
        <TabsContent
          key={source.name}
          value={`ldap:${source.name}`}
          className="mt-0"
        >
          {ldapForm(source)}
        </TabsContent>
      ))}
    </Tabs>
  );

  const oidcButtons =
    oidcSources.length > 0 ? (
      <>
        <div className="my-4 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            {translate("pages.auth.divider")}
          </span>
          <Separator className="flex-1" />
        </div>
        <div className="space-y-2">
          {oidcSources.map((source) => (
            <Button
              key={source.name}
              type="button"
              variant="outline"
              className="w-full h-10"
              onClick={() => startOidcLogin(source)}
            >
              {translate("pages.login.buttons.continueWith", {
                name: source.display_name,
              })}
            </Button>
          ))}
        </div>
      </>
    ) : null;

  const Content = (
    <Card
      className={cn("w-full max-w-md", contentProps?.className)}
      {...contentProps}
    >
      <CardHeader className="pb-0 pt-6">
        <CardTitle className="text-center text-2xl font-bold text-[hsl(var(--foreground))]">
          {translate("pages.login.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-8 pt-6 pb-6">
        {passwordForms}
        {oidcButtons}
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
