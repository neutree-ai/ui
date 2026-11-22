import React from "react";
import { createRoot } from "react-dom/client";

import { captureSsoCallback } from "@/foundation/lib/sso-callback";
import Root from "./Root";

// Take an SSO login result out of the address bar before the router reads it.
captureSsoCallback();

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
