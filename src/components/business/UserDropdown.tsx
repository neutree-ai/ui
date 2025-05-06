import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { useGetIdentity, useGetLocale, useSetLocale } from "@refinedev/core";
import LogoutButton from "./LogoutButton";
import { Button } from "@/components/ui/button";
import { ChevronDown, Globe, Check } from "lucide-react";

export const UserDropdown = () => {
  const { data: identity } = useGetIdentity<{
    user_metadata: {
      username: string;
    };
    email?: string;
  }>();

  const locale = useGetLocale();
  const setLocale = useSetLocale();

  const currentLocale = locale() || "en-US";

  const languages = [
    { code: "en-US", label: "English" },
    { code: "zh-CN", label: "中文" },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="px-3">
          {identity?.user_metadata.username || ""}
          <ChevronDown size={16} className="ml-1.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem className="cursor-default focus:bg-transparent">
          <div className="flex flex-col py-1">
            <div className="font-medium">
              {identity?.user_metadata.username}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {identity?.email}
            </div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Globe size={16} className="" />
            <span>Language</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="min-w-[180px]">
              {languages.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => setLocale(lang.code)}
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{lang.label}</span>
                    {currentLocale === lang.code && (
                      <Check size={16} className="text-primary" />
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogoutButton />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
