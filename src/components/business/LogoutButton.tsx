import { useInvalidate, useLogout } from "@refinedev/core";
import { Button } from "@/components/ui/button";
import { LogOutIcon } from "lucide-react";

export default function LogoutButton() {
  const { mutate: logout } = useLogout();
  const invalidate = useInvalidate();

  return (
    <>
      <Button
        onClick={() => {
          logout();
          invalidate({
            invalidates: ["all"],
          });
        }}
        variant="ghost"
        className="p-0 h-auto w-full justify-start"
      >
        <LogOutIcon size={16} className="mr-2" />
        Logout
      </Button>
    </>
  );
}
