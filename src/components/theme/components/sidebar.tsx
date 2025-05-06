import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import React from "react";
import { useMenu, useResourceParams } from "@refinedev/core";
import type { TreeMenuItem } from "@refinedev/core/dist/hooks/menu/useMenu";
import { useLocation } from "react-use";
import { useWorkspace } from "../hooks";
import type { LayoutProps } from "../types";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "./link";

const GetIcon = (item: TreeMenuItem) => {
	const icon = item.meta?.icon;
	if (React.isValidElement(icon)) {
		return React.cloneElement<any>(icon, {
			className: "mr-1 w-4 h-4",
		});
	}
	return null;
};

type AppSidebarMenuItemProps = {
	item: TreeMenuItem;
	key: React.Key;
	state: "collapsed" | "expanded";
};

function AppSidebarMenuItem({ item, state }: AppSidebarMenuItemProps) {
	const resourceParams = useResourceParams();
	const { current: currentWorkspace } = useWorkspace();
	const { pathname } = useLocation();
	const currentPathname = String(pathname);

	const paths = [
		item.list?.toString(),
		item.create?.toString(),
		item.edit?.toString()?.replace(":id", resourceParams.id as string),
		item.show?.toString()?.replace(":id", resourceParams.id as string),
	]
		.map((s) => s?.replace(":workspace", currentWorkspace))
		.filter(Boolean) as string[];

	const route = item.route?.replace(":workspace", currentWorkspace);

	const isActive =
		paths.includes(currentPathname) ||
		paths.some((path) => {
			return (
				path?.startsWith(currentPathname) || currentPathname.startsWith(path)
			);
		});

	return (
		<SidebarMenuItem className="px-1">
			{state === "collapsed" ? (
				<Tooltip delayDuration={0}>
					<TooltipTrigger asChild>
						<Link
							href={route ?? "/#"}
							title={item.meta?.title ?? item.name}
							className={cn(
								buttonVariants({
									variant: "ghost",
								}),
								"justify-center w-full",
								isActive
									? "bg-primary text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground"
									: "",
							)}
						>
							{item.meta?.icon}
							<span className="sr-only">
								{item.meta?.title ?? item.label} {item.list ? "List" : "Create"}
							</span>
						</Link>
					</TooltipTrigger>
					<TooltipContent side="right" className="flex items-center gap-4">
						{item.label}
						{item.meta?.label && (
							<span className="ml-auto text-muted-foreground">
								{item.meta?.label}
							</span>
						)}
					</TooltipContent>
				</Tooltip>
			) : (
				<Link
					href={route ?? "/#"}
					title={item.meta?.title ?? item.name}
					className={cn(
						buttonVariants({
							variant: "ghost",
						}),
						"justify-start w-full",
						isActive
							? "bg-primary text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground"
							: "",
					)}
				>
					{GetIcon(item)}
					{item.meta?.title ?? item.name}
				</Link>
			)}
		</SidebarMenuItem>
	);
}

type AppSidebarProps = Pick<LayoutProps, "logo">;

export function AppSidebar({ logo }: AppSidebarProps) {
	const { menuItems } = useMenu({
		hideOnMissingParameter: false,
	});

	const { state } = useSidebar();

	return (
		<Sidebar collapsible="icon" variant="floating">
			<SidebarHeader>
				{state === "collapsed" ? logo.collapsed : logo.default}
			</SidebarHeader>
			<SidebarContent>
				<SidebarMenu>
					{menuItems
						.filter((i) => !i.meta?.hide)
						.map((item, key) => {
							if (item.children.length) {
								return (
									<SidebarGroup key={key}>
										<SidebarGroupLabel>
											{item.meta?.title ?? item.name}
										</SidebarGroupLabel>
										<SidebarGroupContent>
											<SidebarMenu>
												{item.children
													.filter((i) => !i.meta?.hide)
													.map((childItem, key) => {
														return (
															<AppSidebarMenuItem
																key={key}
																item={childItem}
																state={state}
															/>
														);
													})}
											</SidebarMenu>
										</SidebarGroupContent>
									</SidebarGroup>
								);
							}

							return <AppSidebarMenuItem key={key} item={item} state={state} />;
						})}
				</SidebarMenu>
			</SidebarContent>
		</Sidebar>
	);
}
