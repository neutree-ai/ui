import type React from "react";
import {
	useForgotPassword,
	useTranslate,
	useActiveAuthProvider,
} from "@refinedev/core";
import type { ForgotPasswordFormTypes } from "@refinedev/core";
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
import { cn } from "@/lib/utils";
import { ThemedTitle } from "./ThemedTitle";
import { authStyles } from "./styles";

type ForgotPasswordPageProps = {
	contentProps?: React.HTMLAttributes<HTMLDivElement>;
	wrapperProps?: React.HTMLAttributes<HTMLDivElement>;
	renderContent?: (
		content: React.ReactNode,
		title: React.ReactNode,
	) => React.ReactNode;
	formProps?: React.ComponentProps<"form">;
	title?: React.ReactNode;
	mutationVariables?: any;
};

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
	contentProps,
	wrapperProps,
	renderContent,
	formProps,
	title,
	mutationVariables,
}) => {
	const translate = useTranslate();
	const authProvider = useActiveAuthProvider();
	const { mutate: forgotPassword, isLoading } =
		useForgotPassword<ForgotPasswordFormTypes>({
			v3LegacyAuthProviderCompatible: Boolean(authProvider?.isLegacy),
		});

	const PageTitle =
		title === false ? null : (
			<div className="flex justify-center mb-8 text-xl">
				{title ?? <ThemedTitle collapsed={false} />}
			</div>
		);

	const Content = (
		<Card
			className={cn("w-full max-w-md", contentProps?.className)}
			{...contentProps}
		>
			<CardHeader className="pb-0 pt-6">
				<CardTitle className="text-center text-2xl font-bold text-[hsl(var(--foreground))]">
					{translate("pages.forgotPassword.title", "Forgot Password")}
				</CardTitle>
			</CardHeader>
			<CardContent className="px-8 pt-6">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						const data = new FormData(e.currentTarget);
						forgotPassword({
							email: data.get("email") as string,
							...mutationVariables,
						});
					}}
					{...formProps}
				>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="email">
								{translate("pages.forgotPassword.fields.email", "Email")}
							</Label>
							<Input
								id="email"
								name="email"
								type="email"
								placeholder="you@example.com"
								required
								className="h-10"
							/>
						</div>
						<Button
							type="submit"
							className="w-full h-10 mt-4"
							disabled={isLoading}
						>
							{isLoading
								? "Loading..."
								: translate(
										"pages.forgotPassword.buttons.submit",
										"Send Reset Instructions",
									)}
						</Button>
					</div>
				</form>
			</CardContent>
			<CardFooter className="pb-6 px-8 flex justify-center">
				<div className="text-sm text-center">
					{translate("pages.forgotPassword.buttons.backLogin", "Back to login")}{" "}
					<a
						href="/login"
						className="font-medium text-[hsl(var(--primary))] hover:underline"
					>
						{translate("pages.forgotPassword.signin", "Sign in")}
					</a>
				</div>
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
