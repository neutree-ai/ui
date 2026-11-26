import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SubscriptionExpiryAlert } from "./SubscriptionExpiryAlert";
import { useLicense } from "./use-license";

vi.mock("./use-license", () => ({ useLicense: vi.fn() }));

it("keeps the expiry warning visible until the license is renewed", () => {
  vi.mocked(useLicense).mockReturnValue({
    isExpiredSubscription: true,
  } as ReturnType<typeof useLicense>);
  const { rerender } = render(<SubscriptionExpiryAlert />);
  const alert = screen.getByRole("alert");
  within(alert).getByText("license.subscriptionExpired");
  expect(within(alert).queryByRole("button")).toBeNull();

  vi.mocked(useLicense).mockReturnValue({
    isExpiredSubscription: false,
  } as ReturnType<typeof useLicense>);
  rerender(<SubscriptionExpiryAlert />);
  expect(screen.queryByRole("alert")).toBeNull();
});
