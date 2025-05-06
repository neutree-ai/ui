import { cn } from "@/lib/utils";
import type React from "react";
import { forwardRef } from "react";

const Loader = forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
	({ className, ...props }, ref) => {
		return (
			<svg
				ref={ref}
				xmlns="http://www.w3.org/2000/svg"
				className={cn("mx-auto inline", className)}
				viewBox="0 0 120 30"
				fill="currentColor"
				{...props}
			>
				<title>Loading...</title>
				<circle cx="15" cy="15" r="15">
					<animate
						attributeName="r"
						begin="0s"
						calcMode="linear"
						dur="0.8s"
						from="15"
						repeatCount="indefinite"
						to="15"
						values="15;9;15"
					/>
					<animate
						attributeName="fill-opacity"
						begin="0s"
						calcMode="linear"
						dur="0.8s"
						from="1"
						repeatCount="indefinite"
						to="1"
						values="1;.5;1"
					/>
				</circle>
				<circle cx="60" cy="15" r="9" fillOpacity="0.3">
					<animate
						attributeName="r"
						begin="0s"
						calcMode="linear"
						dur="0.8s"
						from="9"
						repeatCount="indefinite"
						to="9"
						values="9;15;9"
					/>
					<animate
						attributeName="fill-opacity"
						begin="0s"
						calcMode="linear"
						dur="0.8s"
						from="0.5"
						repeatCount="indefinite"
						to="0.5"
						values=".5;1;.5"
					/>
				</circle>
				<circle cx="105" cy="15" r="15">
					<animate
						attributeName="r"
						begin="0s"
						calcMode="linear"
						dur="0.8s"
						from="15"
						repeatCount="indefinite"
						to="15"
						values="15;9;15"
					/>
					<animate
						attributeName="fill-opacity"
						begin="0s"
						calcMode="linear"
						dur="0.8s"
						from="1"
						repeatCount="indefinite"
						to="1"
						values="1;.5;1"
					/>
				</circle>
			</svg>
		);
	},
);

export default Loader;
