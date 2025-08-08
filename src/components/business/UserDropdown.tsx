import { Link } from "@/components/theme/components/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSystemApi } from "@/hooks/use-system-api";
import { useTranslation } from "@/lib/i18n";
import { useGetIdentity, useGetLocale, useSetLocale } from "@refinedev/core";
import { Check, ChevronDown, Globe, KeyRound } from "lucide-react";
import LogoutButton from "./LogoutButton";

export const UserDropdown = () => {
  const { t } = useTranslation();
  const { data: identity } = useGetIdentity<{
    user_metadata: {
      username: string;
    };
    email?: string;
  }>();
  const { systemInfo } = useSystemApi();

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
            <div className="font-medium text-foreground">
              {identity?.user_metadata.username}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {identity?.email}
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="cursor-default focus:bg-transparent">
          <div className="flex py-1 w-full items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">
              {t("ui.version")}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {systemInfo?.version || "-"}
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Globe size={16} className="mr-2" />
            <span>{t("ui.language")}</span>
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
          <Link href="/update-password" className="flex flex-row gap-2 w-full">
            <KeyRound size={16} className="mr-2" />
            {t("buttons.updatePassword")}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogoutButton />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
