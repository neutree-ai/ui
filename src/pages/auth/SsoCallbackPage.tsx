import { useGo, useInvalidateAuthStore, useLink } from "@refinedev/core";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/foundation/components/Loader";
import { useTranslation } from "@/foundation/lib/i18n";
import {
  clearCapturedSsoCallback,
  getCapturedSsoCallback,
  takePostLoginPath,
} from "@/foundation/lib/sso-callback";
import { verifySsoToken } from "@/foundation/providers/auth-provider";
import { authStyles } from "./styles";
import { ThemedTitle } from "./ThemedTitle";

// The server's error codes that have their own message; any other code gets
// the generic one.
const KNOWN_ERRORS = new Set([
  "invalid_state",
  "idp_error",
  "idp_unavailable",
  "login_failed",
  "server_error",
  "source_unavailable",
]);

// The token is single use and React may run effects twice, so each token is
// redeemed at most once per page load.
const verifications = new Map<string, ReturnType<typeof verifySsoToken>>();

const verifyOnce = (tokenHash: string) => {
  let pending = verifications.get(tokenHash);
  if (!pending) {
    pending = verifySsoToken(tokenHash);
    verifications.set(tokenHash, pending);
  }
  return pending;
};

type State = { status: "verifying" } | { status: "error"; messageKey: string };

const initialState = (): State => {
  const result = getCapturedSsoCallback();
  if (!result) {
    return { status: "error", messageKey: "pages.ssoCallback.errors.missing" };
  }
  if (result.kind === "error") {
    return {
      status: "error",
      messageKey: KNOWN_ERRORS.has(result.code)
        ? `pages.ssoCallback.errors.${result.code}`
        : "pages.ssoCallback.errors.unknown",
    };
  }
  return { status: "verifying" };
};

export const SsoCallbackPage = () => {
  const { t } = useTranslation();
  const go = useGo();
  const Link = useLink();
  const invalidateAuthStore = useInvalidateAuthStore();
  const [state, setState] = useState<State>(initialState);

  useEffect(() => {
    const result = getCapturedSsoCallback();
    if (result?.kind !== "token") {
      clearCapturedSsoCallback();
      return;
    }

    let cancelled = false;
    verifyOnce(result.tokenHash).then(async ({ success }) => {
      if (cancelled) {
        return;
      }
      clearCapturedSsoCallback();
      if (!success) {
        setState({
          status: "error",
          messageKey: "pages.ssoCallback.errors.verifyFailed",
        });
        return;
      }
      await invalidateAuthStore();
      go({ to: takePostLoginPath() ?? "/", type: "replace" });
    });

    return () => {
      cancelled = true;
    };
  }, [go, invalidateAuthStore]);

  return (
    <div className={authStyles.container}>
      <div className="w-full flex flex-col items-center justify-center px-4 py-12">
        <div className="flex justify-center mb-8 text-xl">
          <ThemedTitle collapsed={false} />
        </div>
        <Card className="w-full max-w-md" data-testid="sso-callback">
          <CardHeader className="pb-0 pt-6">
            <CardTitle className="text-center text-2xl font-bold text-[hsl(var(--foreground))]">
              {state.status === "verifying"
                ? t("pages.ssoCallback.signingIn")
                : t("pages.ssoCallback.failedTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-8 pt-6 pb-6">
            {state.status === "verifying" ? (
              <div className="flex justify-center">
                <Loader className="w-12 text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="sso-callback-error"
                >
                  {t(state.messageKey)}
                </p>
                <Button asChild className="w-full h-10">
                  <Link to="/login">{t("pages.ssoCallback.backToLogin")}</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
