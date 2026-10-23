import type { AuthPageProps } from "@refinedev/core";
import type React from "react";

import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { LoginPage } from "./LoginPage";
import { UpdatePasswordPage } from "./UpdatePasswordPage";

type AuthProps = AuthPageProps & {
  renderContent?: (
    content: React.ReactNode,
    title: React.ReactNode,
  ) => React.ReactNode;
  title?: React.ReactNode;
};

export const AuthPage: React.FC<AuthProps> = (props) => {
  const { type } = props;

  const renderView = () => {
    switch (type) {
      case "forgotPassword":
        return <ForgotPasswordPage {...props} />;
      case "updatePassword":
        return <UpdatePasswordPage {...props} />;
      default:
        return <LoginPage rememberMe={<div />} {...props} />;
    }
  };

  return <>{renderView()}</>;
};
