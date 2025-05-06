import type React from "react";
import {
	useLogin,
	useTranslate,
	useRouterContext,
	useRouterType,
	useLink,
	useActiveAuthProvider,
	type OAuthProvider,
} from "@refinedev/core";
import type { LoginFormTypes } from "@refinedev/core";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ThemedTitle } from "./ThemedTitle";
import { authStyles } from "./styles";

type LoginPageProps = {
	providers?: OAuthProvider[];
	registerLink?: React.ReactNode;
	forgotPasswordLink?: React.ReactNode;
	rememberMe?: React.ReactNode;
	contentProps?: React.HTMLAttributes<HTMLDivElement>;
	wrapperProps?: React.HTMLAttributes<HTMLDivElement>;
	renderContent?: (
		content: React.ReactNode,
		title: React.ReactNode,
	) => React.ReactNode;
	formProps?: React.ComponentProps<"form">;
	title?: React.ReactNode;
	hideForm?: boolean;
	mutationVariables?: any;
};

export const LoginPage: React.FC<LoginPageProps> = ({
	providers,
	registerLink,
	forgotPasswordLink,
	rememberMe,
	contentProps,
	wrapperProps,
	renderContent,
	formProps,
	title,
	hideForm,
	mutationVariables,
}) => {
	const translate = useTranslate();
	const routerType = useRouterType();
	const Link = useLink();
	const { Link: LegacyLink } = useRouterContext();
	const ActiveLink = routerType === "legacy" ? LegacyLink : Link;

	const authProvider = useActiveAuthProvider();
	const { mutate: login, isLoading } = useLogin<LoginFormTypes>({
		v3LegacyAuthProviderCompatible: Boolean(authProvider?.isLegacy),
	});

	const PageTitle =
		title === false ? null : (
			<div className="flex flex-col items-center">
				<img alt="logo" src="/logo.png" className="w-20 h-20" />
				<div className="flex justify-center mb-8 text-xl">
					{title ?? <ThemedTitle collapsed={false} />}
				</div>
			</div>
		);

	const renderProviders = () => {
		if (providers && providers.length > 0) {
			return (
				<>
					{providers.map((provider) => (
						<Button
							key={provider.name}
							variant="outline"
							className="w-full mb-2 flex justify-center items-center"
							onClick={() =>
								login({
									...mutationVariables,
									providerName: provider.name,
								})
							}
						>
							{provider.icon && <span className="mr-2">{provider.icon}</span>}
							{provider.label}
						</Button>
					))}
					{!hideForm && (
						<div className="relative my-4">
							<Separator className="my-4">
								<span className="text-[hsl(var(--muted-foreground))] px-2">
									{translate("pages.login.Separator", "or")}
								</span>
							</Separator>
						</div>
					)}
				</>
			);
		}
		return null;
	};

	const Content = (
		<Card
			className={cn("w-full max-w-md", contentProps?.className)}
			{...contentProps}
		>
			<CardHeader className="pb-0 pt-6">
				<CardTitle className="text-center text-2xl font-bold text-[hsl(var(--foreground))]">
					{translate("pages.login.title", "Sign in to your account")}
				</CardTitle>
			</CardHeader>
			<CardContent className="px-8 pt-6">
				{renderProviders()}
				{!hideForm && (
					<form
						onSubmit={(e) => {
							e.preventDefault();
							const data = new FormData(e.currentTarget);
							login({
								email: data.get("email") as string,
								password: data.get("password") as string,
								remember: data.get("remember") === "on",
								...mutationVariables,
							});
						}}
						{...formProps}
					>
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="email">
									{translate("pages.login.fields.email", "Email")}
								</Label>
								<Input
									id="email"
									name="email"
									type="email"
									placeholder="you@example.com"
									required
									className="h-10"
									autoComplete="email"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="password">
									{translate("pages.login.fields.password")}
								</Label>
								<Input
									id="password"
									name="password"
									type="password"
									placeholder="••••••••"
									required
									className="h-10"
									autoComplete="current-password"
								/>
							</div>
							<div className="flex items-center justify-between">
								{rememberMe ?? (
									<div className="flex items-center space-x-2">
										<Checkbox id="remember" name="remember" />
										<Label htmlFor="remember" className="text-sm font-normal">
											{translate(
												"pages.login.buttons.rememberMe",
												"Remember me",
											)}
										</Label>
									</div>
								)}
								{forgotPasswordLink ?? (
									<ActiveLink
										className="text-sm font-medium text-[hsl(var(--primary))] hover:underline ml-auto"
										to="/forgot-password"
									>
										{translate(
											"pages.login.buttons.forgotPassword",
											"Forgot password?",
										)}
									</ActiveLink>
								)}
							</div>
							<Button
								type="submit"
								className="w-full h-10"
								disabled={isLoading}
							>
								{isLoading
									? "Loading..."
									: translate("pages.login.signin", "Sign in")}
							</Button>
						</div>
					</form>
				)}
			</CardContent>
			<CardFooter className="pb-6 px-8 flex justify-center">
				{registerLink ?? (
					<div className="text-sm text-center">
						{translate("pages.login.buttons.noAccount")}{" "}
						<ActiveLink
							to="/register"
							className="font-medium text-[hsl(var(--primary))] hover:underline"
						>
							{translate("pages.login.signup")}
						</ActiveLink>
					</div>
				)}
			</CardFooter>
		</Card>
	);

	return (
		<div
			className={cn(authStyles.container, wrapperProps?.className)}
			{...wrapperProps}
		>
			<div className="w-full flex flex-col items-center justify-center px-4 py-12">
				{renderContent ? (
					renderContent(Content, PageTitle)
				) : (
					<>
						{PageTitle}
						{Content}
					</>
				)}
			</div>
		</div>
	);
};
