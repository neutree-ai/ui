export const getResourcePlural = (name: string) => {
  if (name.endsWith("y")) {
    return `${name.slice(0, -1)}ies`;
  }
  return `${name}s`;
};
