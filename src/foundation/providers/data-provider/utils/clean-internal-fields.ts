// biome-ignore lint/suspicious/noExplicitAny: accepts any object shape from Refine's generic TVariables
export function cleanInternalFields(variables: any) {
  for (const key in variables) {
    if (key.startsWith("-")) {
      delete variables[key];
    }
  }
}
