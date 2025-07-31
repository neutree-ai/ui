import type { AuthPageProps } from "@refinedev/core";
import type React from "react";

import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";
import { UpdatePasswordPage } from "./UpdatePasswordPage";

export type AuthProps = AuthPageProps & {
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
      case "register":
        return <RegisterPage {...props} />;
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
