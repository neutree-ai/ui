import {
	useState,
	useEffect,
	forwardRef,
	type ChangeEventHandler,
} from "react";
import { Plus, Trash, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// IP address validation regex
const ipRegex =
	/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

type IpsValue = {
	head_ip: string;
	worker_ips: string[];
};

type NodeIPsFieldProps = Partial<{
	value: IpsValue;
	onChange: (value: IpsValue) => void;
	disabled: boolean;
}>;

const NodeIPsField = forwardRef<HTMLDivElement, NodeIPsFieldProps>(
	(
		{ value = { head_ip: "", worker_ips: [] }, onChange, disabled = false },
		ref,
	) => {
		const [headIp, setHeadIp] = useState(value.head_ip || "");
		const [workerIps, setworkerIps] = useState(value.worker_ips || []);
		const [newWorkerIp, setNewWorkerIp] = useState("");
		const [errors, setErrors] = useState({
			headIp: "",
			workerIps: {},
			newWorkerIp: "",
		});

		// Update the parent form when values change
		useEffect(() => {
			if (onChange) {
				onChange({ head_ip: headIp, worker_ips: workerIps });
			}
		}, [headIp, workerIps, onChange]);

		// Validate an IP address
		const validateIp = (ip: string) => {
			if (!ip) return "IP address is required";
			if (!ipRegex.test(ip)) return "Invalid IP address format";
			return "";
		};

		// Handle head node IP change
		const handleheadIpChange: ChangeEventHandler<HTMLInputElement> = (e) => {
			const ip = e.target.value;
			setHeadIp(ip);
			setErrors({
				...errors,
				headIp: validateIp(ip),
			});
		};

		// Handle new worker IP input change
		const handleNewWorkerIpChange: ChangeEventHandler<HTMLInputElement> = (
			e,
		) => {
			const ip = e.target.value;
			setNewWorkerIp(ip);
			setErrors({
				...errors,
				newWorkerIp: ip ? validateIp(ip) : "",
			});
		};

		// Add a new worker node IP
		const addWorkerNodeIp = () => {
			if (disabled) return;

			// Validate the new IP
			const error = validateIp(newWorkerIp);
			if (error) {
				setErrors({
					...errors,
					newWorkerIp: error,
				});
				return;
			}

			// Check for duplicates
			if (workerIps.includes(newWorkerIp) || newWorkerIp === headIp) {
				setErrors({
					...errors,
					newWorkerIp: "This IP address is already in use",
				});
				return;
			}

			// Add the new IP and clear the input
			setworkerIps([...workerIps, newWorkerIp]);
			setNewWorkerIp("");
			setErrors({
				...errors,
				newWorkerIp: "",
			});
		};

		// Remove a worker node IP
		const removeWorkerNodeIp = (ipToRemove: string) => {
			if (disabled) return;

			setworkerIps(workerIps.filter((ip) => ip !== ipToRemove));

			// Clear any errors for this IP
			const updatedErrors = { ...errors };
			if (ipToRemove in updatedErrors.workerIps) {
				delete (updatedErrors.workerIps as Record<string, unknown>)[ipToRemove];
			}
			setErrors(updatedErrors);
		};

		return (
			<div className="space-y-4" ref={ref}>
				{/* Head Node IP */}
				<Card className="border border-border">
					<CardHeader className="bg-secondary text-secondary-foreground py-2 px-4">
						<div className="flex items-center">
							<CardTitle className="text-sm">Head Node IP</CardTitle>
						</div>
					</CardHeader>
					<CardContent className="p-4">
						<div className="flex flex-col">
							<div className="flex items-center">
								<Input
									value={headIp}
									onChange={handleheadIpChange}
									placeholder="e.g 192.168.1.1"
									disabled={disabled}
									className={errors.headIp ? "border-destructive" : ""}
								/>
							</div>
							{errors.headIp && (
								<div className="flex items-center mt-1 text-sm text-destructive">
									<AlertCircle className="h-4 w-4 mr-1" />
									<span>{errors.headIp}</span>
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				<Card className="border border-border">
					<CardHeader className="bg-secondary text-secondary-foreground py-2 px-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center">
								<CardTitle className="text-sm">Worker Node IPs</CardTitle>
							</div>
							<Badge variant="outline">{workerIps.length} nodes</Badge>
						</div>
					</CardHeader>
					<CardContent className="p-4">
						{/* Worker IP list */}
						<div className="space-y-2 mb-4">
							{workerIps.length === 0 ? (
								<div className="text-sm text-muted-foreground p-2 bg-muted rounded">
									No worker nodes added. Add at least one worker node.
								</div>
							) : (
								workerIps.map((ip, index) => (
									<div
										key={index}
										className="flex items-center justify-between p-2 bg-card border border-border rounded"
									>
										<div className="flex items-center">
											<span className="font-mono text-sm">{ip}</span>
										</div>
										{!disabled && (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => removeWorkerNodeIp(ip)}
												className="h-8 w-8 p-0"
											>
												<Trash className="h-4 w-4 text-destructive" />
											</Button>
										)}
									</div>
								))
							)}
						</div>

						{/* Add new worker node IP */}
						{!disabled && (
							<div className="flex flex-col">
								<div className="flex items-center">
									<Input
										value={newWorkerIp}
										onChange={handleNewWorkerIpChange}
										placeholder="Add new worker node IP"
										className={`flex-1 ${
											errors.newWorkerIp ? "border-destructive" : ""
										}`}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												addWorkerNodeIp();
											}
										}}
									/>
									<Button
										onClick={addWorkerNodeIp}
										className="ml-2"
										disabled={!newWorkerIp || !!errors.newWorkerIp}
									>
										<Plus className="h-4 w-4 mr-1" />
										Add
									</Button>
								</div>
								{errors.newWorkerIp && (
									<div className="flex items-center mt-1 text-sm text-destructive">
										<AlertCircle className="h-4 w-4 mr-1" />
										<span>{errors.newWorkerIp}</span>
									</div>
								)}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		);
	},
);

// Add display name for better debugging
NodeIPsField.displayName = "NodeIPsField";

export default NodeIPsField;
