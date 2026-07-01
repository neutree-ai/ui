import { createContext } from "react";

type ResourceFormSubmitContextValue = {
  registerBeforeSubmit: (handler: () => boolean | undefined) => () => void;
};

export const ResourceFormSubmitContext =
  createContext<ResourceFormSubmitContextValue | null>(null);
