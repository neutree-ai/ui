export const isValidIPAddress = (ip: string): boolean => {
  const ipRegex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
};

export const isValidPath = (path: string): boolean => {
  // Check if it's a valid Unix/Linux path
  const pathRegex = /^\/[a-zA-Z0-9._/-]*$/;
  return pathRegex.test(path) && path.length > 0;
};

export const isNfsProtocol = (url: string): boolean => {
  return url.trim().startsWith("nfs://");
};
