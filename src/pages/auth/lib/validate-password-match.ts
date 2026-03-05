export function validatePasswordMatch(
  password: string,
  confirmPassword: string,
): boolean {
  return password === confirmPassword;
}
