import { useState, useEffect, useMemo } from "react";
import { Calendar, Mail, User, ChevronRight, Building2, MessageSquare } from "lucide-react";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
	Legend,
	LabelList,
} from "recharts";
import { normalizeNewlines } from "../utils/text";
import { motion, AnimatePresence } from "motion/react";

type ContactInfo = {
	name: string;
	email: string;
};

type ContactLike = {
	name?: string | null;
	email?: string | null;
};

type Company = {
	id: number;
	name: string;
};

type SourceApplication = {
	id: number;
	companyName?: string | null;
	company?: string | null;
	companyId?: number | null;
	role?: string | null;
	title?: string | null;
	dateApplied?: string | null;
	applied_date?: string | null;
	dateAppliedTs?: number | null;
	interviewDate?: string | null;
	interview_date?: string | null;
	dateOfInterview?: string | null;
	contacts?: Array<ContactLike | null> | null;
	metadata?: { contacts?: Array<ContactLike | null> | null } | null;
	status?: unknown;
	statusNotes?: string | null;
	status_notes?: string | null;
	notes?: string | null;
	track?: unknown;
};

type InterviewRecord = {
	id: number;
	companyName: string;
	role: string;
	submissionDate: string;
	submissionTs: number;
	interviewDate: string;
	contacts: ContactInfo[];
	status: string;
	statusHistory: string;
	hrPerson: ContactInfo;
};

type PieLabelProps = {
	cx: number;
	cy: number;
	midAngle: number;
	outerRadius: number;
	percent?: number;
	index: number;
};

type BarLabelProps = {
	x: number;
	y: number;
	width: number;
	height: number;
	value: number | string;
};

type SortKey = "companyName" | "role" | "interviewDate" | "submissionDate" | "status";
type TimelineGranularity = "monthly" | "yearly";
type TimelineBucket = {
	key: string;
	label: string;
	ts: number;
};

const emptyContact: ContactInfo = { name: "", email: "" };

const parseLocalYMD = (value?: string) => {
	if (!value) return null;

	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (match) {
		const year = Number.parseInt(match[1], 10);
		const month = Number.parseInt(match[2], 10) - 1;
		const day = Number.parseInt(match[3], 10);
		return new Date(year, month, day);
	}

	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDisplayDate = (isoDate: string) => {
	const date = parseLocalYMD(isoDate) || new Date(isoDate);
	const day = String(date.getDate()).padStart(2, "0");
	const month = date.toLocaleString("en-US", { month: "short" });
	const year = date.getFullYear();
	return `${day} ${month} ${year}`;
};

const formatDisplayMonth = (date: Date) =>
	date.toLocaleString("en-US", {
		month: "short",
		year: "numeric",
	});

const getMonthYear = (isoDate: string) => {
	const date = parseLocalYMD(isoDate) || new Date(isoDate);
	return formatDisplayMonth(date);
};

const timelineGranularityOptions: Array<{ label: string; value: TimelineGranularity }> = [
	{ label: "Monthly", value: "monthly" },
	{ label: "Yearly", value: "yearly" },
];

const statusOptions = [
	"Applied",
	"System Rejected",
	"AI Interview",
	"Email Enquiry",
	"Preliminary Call",
	"Interview",
	"Offer",
	"Rejected",
	"Withdrawn",
	"Paused",
	"No Update",
	"Closed",
];

const chartColors = [
	"#0088FE",
	"#687530",
	"#783330",
	"#F39C12",
	"#397D58",
	"#00C49F",
	"#FFBB28",
	"#F38042",
	"#8884d8",
	"#D35400",
	"#e0AEC0",
	"#6B7280",
];

const getTextValue = (value: unknown) => (typeof value === "string" ? value : "");

const normalizeToIsoDate = (value: unknown) => {
	const raw = getTextValue(value).trim();
	if (!raw) return "";
	if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

	const parsed = new Date(raw);
	return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

const normalizeContacts = (
	contacts: Array<ContactLike | null> | null | undefined,
): ContactInfo[] => {
	if (!Array.isArray(contacts)) return [];

	return contacts.filter(Boolean).map((contact) => ({
		name: getTextValue(contact?.name),
		email: getTextValue(contact?.email),
	}));
};

const isTrackedApplication = (trackValue: unknown) =>
	trackValue === "t" ||
	trackValue === "T" ||
	trackValue === true ||
	(typeof trackValue === "string" && trackValue.toLowerCase() === "true");

const formatSourceStatus = (status: unknown) => {
	const raw = getTextValue(status).trim();
	if (!raw) return "Applied";
	return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const getDateSource = (item: InterviewRecord) => item.submissionDate || item.interviewDate || "";

const isCompletedStatus = (status: string) => status.toLowerCase() === "completed";

const isScheduledStatus = (status: string) => status.toLowerCase().includes("sched");

const getStatusBadgeClass = (status: string) => {
	if (isCompletedStatus(status)) return "bg-green-100 text-green-700";
	if (isScheduledStatus(status)) return "bg-blue-100 text-blue-700";
	return "bg-yellow-100 text-yellow-700";
};

const toInterviewRecord = (
	record: SourceApplication,
	companiesMap: Map<number, string>,
): InterviewRecord => {
	const submissionDate = normalizeToIsoDate(record.dateApplied ?? record.applied_date);
	const parsedSubmissionDate = submissionDate ? parseLocalYMD(submissionDate) : null;
	const contacts = normalizeContacts(record.contacts ?? record.metadata?.contacts);
	const companyId = typeof record.companyId === "number" ? record.companyId : undefined;

	return {
		id: record.id,
		companyName:
			getTextValue(record.companyName).trim() ||
			getTextValue(record.company).trim() ||
			(companyId ? companiesMap.get(companyId) : undefined) ||
			"Unknown",
		role: getTextValue(record.role).trim() || getTextValue(record.title).trim(),
		submissionDate,
		submissionTs:
			typeof record.dateAppliedTs === "number"
				? record.dateAppliedTs
				: parsedSubmissionDate
					? parsedSubmissionDate.getTime()
					: 0,
		interviewDate: normalizeToIsoDate(
			record.interviewDate ?? record.interview_date ?? record.dateOfInterview,
		),
		contacts,
		status: formatSourceStatus(record.status),
		statusHistory:
			getTextValue(record.statusNotes).trim() ||
			getTextValue(record.status_notes).trim() ||
			getTextValue(record.notes).trim(),
		hrPerson: contacts[0] ?? emptyContact,
	};
};

const renderPieLabel = (props: PieLabelProps) => {
	const { cx, cy, midAngle, outerRadius, percent, index } = props;
	const rad = Math.PI / 180;
	const pct = Math.round((percent || 0) * 100);
	if (pct === 0) return null;

	let extra = 18;
	if (pct <= 2) extra += 20;
	else if (pct <= 5) extra += 12;

	const radius = outerRadius + extra;
	const xBase = cx + radius * Math.cos(-midAngle * rad);
	const yBase = cy + radius * Math.sin(-midAngle * rad);
	const stagger = pct <= 5 ? (index % 2 === 0 ? -8 : 8) : 0;
	const x = xBase;
	const y = yBase + stagger;
	const fill = chartColors[index % chartColors.length] || "#333";

	return (
		<text
			x={x}
			y={y}
			fill={fill}
			fontSize={12}
			textAnchor={x > cx ? "start" : "end"}
			dominantBaseline="central"
		>
			{pct}%
		</text>
	);
};

const renderBarLabel = (props: BarLabelProps) => {
	const { x, y, width, height, value } = props;
	const cx = x + width / 2;
	const fontSize = 14;

	if ((height || 0) < 18) {
		return (
			<text
				x={cx}
				y={y - 6}
				fill="#111827"
				fontSize={fontSize}
				fontWeight={700}
				textAnchor="middle"
			>
				{value}
			</text>
		);
	}

	return (
		<text
			x={cx}
			y={y + height / 2}
			fill="#ffffff"
			fontSize={fontSize}
			fontWeight={700}
			textAnchor="middle"
			dominantBaseline="central"
		>
			{value}
		</text>
	);
};

const getTimelineBucket = (date: Date, granularity: TimelineGranularity): TimelineBucket => {
	const year = date.getFullYear();

	if (granularity === "yearly") {
		return {
			key: String(year),
			label: String(year),
			ts: new Date(year, 0, 1).getTime(),
		};
	}

	const month = String(date.getMonth() + 1).padStart(2, "0");
	return {
		key: `${year}-${month}`,
		label: formatDisplayMonth(date),
		ts: new Date(year, date.getMonth(), 1).getTime(),
	};
};

const toCanonicalStatus = (value: unknown) => {
	const raw = String(value || "").trim();
	if (!raw) return "No Update";

	const exactMatch = statusOptions.find((status) => status.toLowerCase() === raw.toLowerCase());
	if (exactMatch) return exactMatch;

	return raw
		.toLowerCase()
		.split(/[\s_-]+/)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
};

const getStatusColor = (statusName: string) => {
	const colorIndex = statusOptions.indexOf(statusName);
	return colorIndex >= 0 ? chartColors[colorIndex % chartColors.length] : "#6B7280";
};

export function InterviewTimeline({
	applications: _applications,
	companies: _companies,
	onViewApplication,
}: {
	applications?: SourceApplication[];
	companies?: Company[];
	onViewApplication?: (id: number) => void;
}) {
	const [data, setData] = useState<InterviewRecord[]>([]);
	const [selectedInterview, setSelectedInterview] = useState<InterviewRecord | null>(null);

	useEffect(() => {
		let mounted = true;

		const updateInterviewState = (records: InterviewRecord[]) => {
			if (!mounted) return;
			setData(records);
			setSelectedInterview(records[0] ?? null);
		};

		const buildFromProps = () => {
			if (!Array.isArray(_applications) || _applications.length === 0) return false;
			const companiesMap = new Map<number, string>();
			for (const company of _companies ?? []) {
				companiesMap.set(company.id, company.name);
			}

			const mapped = _applications
				.filter((record) => isTrackedApplication(record.track))
				.map((record) => toInterviewRecord(record, companiesMap));

			updateInterviewState(mapped);
			return true;
		};

		if (!buildFromProps()) {
			async function loadTrackedJobs() {
				try {
					const resp = await fetch("/api/jobs");
					if (!resp.ok) return;
					const rows = (await resp.json()) as SourceApplication[];
					const mapped = rows
						.filter((record) => isTrackedApplication(record.track))
						.map((record) => toInterviewRecord(record, new Map<number, string>()));
					if (mounted) {
						if (mapped.length > 0) {
							setData(mapped);
							setSelectedInterview(mapped[0]);
						} else {
							// No tracked rows — show empty list
							setData([]);
							setSelectedInterview(null);
						}
					}
				} catch {}
			}
			loadTrackedJobs();
		}

		return () => {
			mounted = false;
		};
	}, [_applications, _companies]);
	const [viewMode, setViewMode] = useState<"timeline" | "list">("timeline");
	const [timelineGranularity, setTimelineGranularity] = useState<TimelineGranularity>("monthly");

	const chartStats = useMemo(() => {
		const timelineCounts = new Map<string, { label: string; count: number; ts: number }>();
		const knownStatusCounts = new Map<string, number>(statusOptions.map((status) => [status, 0]));
		const extraStatusCounts = new Map<string, number>();

		for (const item of data) {
			const dateSource = getDateSource(item);
			const parsedDate = parseLocalYMD(dateSource);
			if (parsedDate) {
				const bucket = getTimelineBucket(parsedDate, timelineGranularity);
				const existing = timelineCounts.get(bucket.key);
				if (existing) {
					existing.count += 1;
				} else {
					timelineCounts.set(bucket.key, {
						label: bucket.label,
						count: 1,
						ts: bucket.ts,
					});
				}
			}

			const statusName = toCanonicalStatus(item.status);
			if (knownStatusCounts.has(statusName)) {
				knownStatusCounts.set(statusName, (knownStatusCounts.get(statusName) || 0) + 1);
			} else {
				extraStatusCounts.set(statusName, (extraStatusCounts.get(statusName) || 0) + 1);
			}
		}

		const timelineData = Array.from(timelineCounts.values())
			.filter((entry) => entry.count > 0)
			.sort((a, b) => a.ts - b.ts);
		const visibleStatusData = [
			...statusOptions.map((status) => ({
				name: status,
				value: knownStatusCounts.get(status) || 0,
			})),
			...Array.from(extraStatusCounts.entries()).map(([name, value]) => ({ name, value })),
		].filter((entry) => entry.value > 0);
		const statusTotal = visibleStatusData.reduce((sum, entry) => sum + entry.value, 0);

		return {
			statusTotal,
			timelineData,
			visibleStatusData,
		};
	}, [data, timelineGranularity]);

	const [sortKey, setSortKey] = useState<SortKey>("submissionDate");
	const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

	const toggleSort = (key: SortKey) => {
		if (sortKey === key) {
			setSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
		} else {
			setSortKey(key);
			setSortDir("desc");
		}
	};

	const appsSorted = useMemo(() => {
		const getValue = (item: InterviewRecord): number | string => {
			switch (sortKey) {
				case "companyName":
					return item.companyName.toLowerCase();
				case "role":
					return item.role.toLowerCase();
				case "interviewDate":
					return parseLocalYMD(item.interviewDate)?.getTime() || 0;
				case "submissionDate":
					return item.submissionTs || parseLocalYMD(item.submissionDate)?.getTime() || 0;
				case "status":
					return item.status.toLowerCase();
				default:
					return "";
			}
		};

		return [...data].sort((a, b) => {
			const aValue = getValue(a);
			const bValue = getValue(b);

			if (typeof aValue === "number" && typeof bValue === "number") {
				return sortDir === "asc" ? aValue - bValue : bValue - aValue;
			}

			const compareResult = String(aValue).localeCompare(String(bValue));
			return sortDir === "asc" ? compareResult : -compareResult;
		});
	}, [data, sortDir, sortKey]);

	const [collapsedYears, setCollapsedYears] = useState<Record<number, boolean>>({});

	const groupsByYear = useMemo(() => {
		const grouped: Record<number, InterviewRecord[]> = {};

		for (const item of appsSorted) {
			const dateSource = getDateSource(item);
			const preferredDate = dateSource
				? (parseLocalYMD(dateSource) ?? new Date(dateSource))
				: new Date(item.submissionTs || Date.now());
			const resolvedDate = Number.isNaN(preferredDate.getTime())
				? new Date(item.submissionTs || Date.now())
				: preferredDate;
			const year = resolvedDate.getFullYear();

			if (!grouped[year]) grouped[year] = [];
			grouped[year].push(item);
		}

		return grouped;
	}, [appsSorted]);

	const years = useMemo(
		() =>
			Object.keys(groupsByYear)
				.map((value) => Number(value))
				.sort((a, b) => b - a),
		[groupsByYear],
	);

	useEffect(() => {
		if (years.length === 0) return;

		const currentYear = new Date().getFullYear();
		setCollapsedYears((previous) => {
			const next = { ...previous };
			for (const year of years) {
				if (!(year in next)) next[year] = year !== currentYear;
			}
			return next;
		});
	}, [years]);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<div>
					<h2 className="text-2xl font-bold text-gray-900">Interview Responses</h2>
					<p className="text-sm text-gray-600 mt-1">
						Track companies that responded and scheduled interviews
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setViewMode("timeline")}
						className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-all ${
							viewMode === "timeline"
								? "bg-blue-600 text-white shadow-sm"
								: "bg-gray-100 text-gray-700 hover:bg-gray-200"
						}`}
					>
						Timeline
					</button>
					<button
						type="button"
						onClick={() => setViewMode("list")}
						className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-all ${
							viewMode === "list"
								? "bg-blue-600 text-white shadow-sm"
								: "bg-gray-100 text-gray-700 hover:bg-gray-200"
						}`}
					>
						List
					</button>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-2 bg-white rounded-lg shadow-md border border-gray-200 p-6">
					<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<h3 className="text-lg font-medium">Applications Over Time</h3>
						<div className="inline-flex w-fit rounded-lg bg-gray-100 p-1">
							{timelineGranularityOptions.map((option) => (
								<button
									key={option.value}
									type="button"
									onClick={() => setTimelineGranularity(option.value)}
									className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
										timelineGranularity === option.value
											? "bg-blue-600 text-white shadow-sm"
											: "text-gray-700 hover:bg-gray-200"
									}`}
								>
									{option.label}
								</button>
							))}
						</div>
					</div>
					<div className="h-80">
						{chartStats.timelineData.length > 0 ? (
							<ResponsiveContainer width="100%" height="100%">
								<BarChart
									data={chartStats.timelineData}
									margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
								>
									<CartesianGrid strokeDasharray="3 3" />
									<XAxis dataKey="label" minTickGap={24} />
									<YAxis allowDecimals={false} />
									<Tooltip formatter={(value) => [`${value} applications`, "Count"]} />
									<Bar dataKey="count" fill="#0088FE">
										<LabelList dataKey="count" content={renderBarLabel} />
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						) : (
							<div className="h-full flex items-center justify-center text-sm text-gray-500">
								No interview application data available.
							</div>
						)}
					</div>
				</div>

				<div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
					<h3 className="text-lg font-medium mb-4">Application Status</h3>
					<div className="h-80">
						{chartStats.visibleStatusData.length > 0 ? (
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={chartStats.visibleStatusData}
										cx="50%"
										cy="45%"
										outerRadius={70}
										fill="#8884d8"
										dataKey="value"
										label={renderPieLabel}
										labelLine={true}
									>
										{chartStats.visibleStatusData.map((entry, index) => (
											<Cell key={`cell-${entry.name}-${index}`} fill={getStatusColor(entry.name)} />
										))}
									</Pie>
									<Tooltip
										formatter={(value, name) => {
											const pct =
												chartStats.statusTotal > 0
													? ((Number(value) / chartStats.statusTotal) * 100).toFixed(1)
													: "0";
											return [`${value} applications (${pct}%)`, name];
										}}
									/>
									<Legend
										layout="horizontal"
										verticalAlign="bottom"
										align="center"
										wrapperStyle={{ paddingTop: "20px" }}
									/>
								</PieChart>
							</ResponsiveContainer>
						) : (
							<div className="h-full flex items-center justify-center text-sm text-gray-500">
								No status data available.
							</div>
						)}
					</div>
				</div>
			</div>

			{viewMode === "timeline" ? (
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Timeline Sidebar */}
					<div className="lg:col-span-1 bg-white rounded-lg shadow-md border border-gray-200 p-4 max-h-[80vh] overflow-y-auto">
						<h3 className="text-lg font-semibold text-gray-900 mb-4 sticky top-0 bg-white pb-2">
							Interview Timeline
						</h3>
						<div className="space-y-4">
							{years.map((yr) => {
								const items = groupsByYear[yr] || [];
								const collapsed = !!collapsedYears[yr];
								return (
									<div key={yr} className="">
										<div className="flex items-center justify-between mb-2">
											<button
												type="button"
												onClick={() => setCollapsedYears((prev) => ({ ...prev, [yr]: !prev[yr] }))}
												className="cursor-pointer flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-gray-50"
											>
												<ChevronRight
													className={`w-4 h-4 text-gray-500 transition-transform ${collapsed ? "" : "rotate-90"}`}
												/>
												<div className="px-3 text-base font-semibold text-gray-600 uppercase tracking-wider bg-white">
													{yr}
												</div>
												<div className="flex-1" />
												<div className="text-sm font-medium text-gray-700">{`(${items.length} item${items.length !== 1 ? "s" : ""})`}</div>
											</button>
										</div>

										<AnimatePresence initial={false}>
											{!collapsed && (
												<motion.div
													key={`group-${yr}`}
													initial={{ opacity: 0, height: 0 }}
													animate={{ opacity: 1, height: "auto" }}
													exit={{ opacity: 0, height: 0 }}
													transition={{ duration: 0.18 }}
													className="space-y-2 overflow-hidden"
												>
													{items.map((item) => {
														const dateSource = getDateSource(item);
														const monthYear = dateSource ? getMonthYear(dateSource) : "";
														return (
															<motion.button
																key={item.id}
																onClick={() => setSelectedInterview(item)}
																className={`cursor-pointer w-full text-left py-2 px-4 rounded-lg transition-all relative ${
																	selectedInterview?.id === item.id
																		? "bg-blue-50 border-2 border-blue-500 shadow-sm"
																		: "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
																}`}
																whileHover={{ scale: 1.02 }}
																whileTap={{ scale: 0.98 }}
															>
																{/* Centered month/year separator inside the item */}
																{monthYear && (
																	<div className="flex items-center justify-center mb-2">
																		<div className="border-t border-gray-200 flex-1 mr-2" />
																		<div className="px-3 text-sm font-semibold text-gray-500 uppercase tracking-wider bg-white">
																			{monthYear}
																		</div>
																		<div className="border-t border-gray-200 flex-1 ml-2" />
																	</div>
																)}

																<div
																	className={`absolute -left-[17px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 ${
																		selectedInterview?.id === item.id
																			? "bg-blue-600 border-blue-600"
																			: "bg-white border-gray-300"
																	}`}
																/>
																<div className="flex items-start justify-between gap-2">
																	<div className="flex-1 min-w-0">
																		<h4 className="font-semibold text-gray-900 text-base truncate">
																			{item.companyName}
																		</h4>
																		<p className="text-sm text-gray-600 mt-0.5 line-clamp-1">
																			{item.role}
																		</p>
																		<div className="flex items-center gap-1 mt-1">
																			<span className="text-sm text-gray-500 mr-1">
																				{" "}
																				Submission Date:{" "}
																			</span>
																			<span className="text-sm text-gray-500">
																				{dateSource ? formatDisplayDate(dateSource) : "N/A"}
																			</span>
																		</div>
																	</div>
																	<span
																		className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getStatusBadgeClass(item.status)}`}
																	>
																		{item.status}
																	</span>
																</div>
															</motion.button>
														);
													})}
												</motion.div>
											)}
										</AnimatePresence>
									</div>
								);
							})}
						</div>
					</div>

					{/* Details Panel */}
					<div className="lg:col-span-2">
						<AnimatePresence mode="wait">
							{selectedInterview && (
								<motion.div
									key={selectedInterview.id}
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -20 }}
									transition={{ duration: 0.2 }}
									className="bg-white rounded-lg shadow-md border border-gray-200 p-6"
								>
									{/* Company Header */}
									<div className="border-b border-gray-200 pb-4 mb-6">
										<div className="flex items-start gap-4">
											<div className="flex items-start gap-3 flex-1">
												<div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
													<Building2 className="w-6 h-6 text-white" />
												</div>
												<div className="flex-1 min-w-0">
													<h3 className="text-2xl font-bold text-gray-900">
														{selectedInterview.companyName}
													</h3>
													<p className="text-gray-600 mt-1">{selectedInterview.role}</p>
												</div>
											</div>
											{/* Compact status badge at top-right */}
											<div className="ml-auto self-start">
												<span
													className={`px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${getStatusBadgeClass(selectedInterview.status)}`}
												>
													{selectedInterview.status || "N/A"}
												</span>
											</div>
										</div>
									</div>

									{/* Interview Details Grid */}
									<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
										{/* Submission Date */}
										<div className="bg-gray-50 rounded-lg p-4">
											<div className="flex items-center mb-2">
												<div className="w-8 h-8 flex items-center justify-center">
													<Calendar className="w-4 h-4 text-blue-600" />
												</div>
												<h4 className="font-semibold text-gray-900">Submission Date</h4>
											</div>
											<p className="text-gray-700 text-lg font-medium">
												{selectedInterview?.submissionDate
													? formatDisplayDate(selectedInterview.submissionDate)
													: "N/A"}
											</p>
										</div>

										{/* Date of Interview */}
										<div className="bg-gray-50 rounded-lg p-4">
											<div className="flex items-center mb-2">
												<div className="w-8 h-8 flex items-center justify-center">
													<Calendar className="w-4 h-4 text-blue-600" />
												</div>
												<h4 className="font-semibold text-gray-900">Interview Date</h4>
											</div>
											<p className="text-gray-700 text-lg font-medium">
												{selectedInterview.interviewDate
													? formatDisplayDate(selectedInterview.interviewDate)
													: "N/A"}
											</p>
										</div>

										{/* HR Contact */}
										<div className="bg-gray-50 rounded-lg p-4">
											<div className="flex items-center mb-2">
												<div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
													<User className="w-4 h-4 text-purple-600" />
												</div>
												<h4 className="font-semibold text-gray-900">HR Contact</h4>
											</div>
											<div className="mt-1">
												<p className="text-gray-900 font-medium">
													{selectedInterview?.contacts?.[0]?.name ||
														selectedInterview?.hrPerson?.name ||
														"N/A"}
												</p>
												{(selectedInterview?.contacts?.[0]?.email ||
													selectedInterview?.hrPerson?.email) && (
													<div className="flex items-center gap-2 mt-1">
														<Mail className="w-3 h-3 text-gray-400" />
														<a
															href={`mailto:${selectedInterview?.contacts?.[0]?.email || selectedInterview?.hrPerson?.email}`}
															className="text-sm text-blue-600 hover:text-blue-800 hover:underline mr-2"
														>
															{selectedInterview?.contacts?.[0]?.email ||
																selectedInterview?.hrPerson?.email}
														</a>
													</div>
												)}
											</div>
										</div>
									</div>

									{/* Interview Notes & Details (read-only textarea like Status History) */}
									<div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-1">
										<div className="flex items-center gap-2 mb-3">
											<div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
												<MessageSquare className="w-4 h-4 text-green-600" />
											</div>
											<h4 className="font-semibold text-gray-900">Interview Notes & Details</h4>
										</div>
										<div className="mt-1">
											<textarea
												name="interviewNotes"
												value={normalizeNewlines(selectedInterview.statusHistory || "").replace(
													/^\s*-{3,}\s*$/gm,
													"------------------------------------------",
												)}
												readOnly
												rows={6}
												wrap="soft"
												style={{ whiteSpace: "pre-wrap" }}
												className="w-full border rounded-md px-3 py-2 h-40 bg-gray-50 text-sm text-gray-700 resize-none overflow-y-auto"
											/>
										</div>
									</div>

									{/* Action: Detailed View button placed at bottom-right of details panel */}
									{onViewApplication && selectedInterview?.id && (
										<div className="mt-4 flex justify-end">
											<button
												type="button"
												onClick={() => onViewApplication(selectedInterview.id)}
												className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 cursor-pointer"
											>
												Detailed View
											</button>
										</div>
									)}
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>
			) : (
				/* List View */
				<div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-gray-200">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										<button
											type="button"
											onClick={() => toggleSort("companyName")}
											className="inline-flex items-center gap-2 cursor-pointer select-none"
										>
											COMPANY
											{sortKey === "companyName" && (
												<span className="ml-2 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>
											)}
										</button>
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										ROLE
										{sortKey === "role" && (
											<span className="ml-2 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>
										)}
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										<button
											type="button"
											onClick={() => toggleSort("interviewDate")}
											className="inline-flex items-center gap-2 cursor-pointer"
										>
											INTERVIEW DATE
											{sortKey === "interviewDate" && (
												<span className="ml-2 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>
											)}
										</button>
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										<button
											type="button"
											onClick={() => toggleSort("submissionDate")}
											className="inline-flex items-center gap-2 cursor-pointer"
										>
											SUBMISSION DATE
											{sortKey === "submissionDate" && (
												<span className="ml-2 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>
											)}
										</button>
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										<button
											type="button"
											onClick={() => toggleSort("status")}
											className="inline-flex items-center gap-2 cursor-pointer"
										>
											STATUS
											{sortKey === "status" && (
												<span className="ml-2 text-xs">{sortDir === "asc" ? "▲" : "▼"}</span>
											)}
										</button>
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										ACTIONS
									</th>
								</tr>
							</thead>
							<tbody className="bg-white divide-y divide-gray-200">
								{appsSorted.map((interview) => (
									<tr key={interview.id} className="hover:bg-gray-50">
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="font-medium text-gray-900">{interview.companyName}</div>
										</td>
										<td className="px-6 py-4">
											<div className="text-sm text-gray-700 max-w-xs">{interview.role}</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm text-gray-700">
												{interview.interviewDate
													? formatDisplayDate(interview.interviewDate)
													: "N/A"}
											</div>
										</td>
										<td className="px-6 py-4">
											<div className="text-sm text-gray-700">
												{interview.submissionDate
													? formatDisplayDate(interview.submissionDate)
													: "N/A"}
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<span
												className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(interview.status)}`}
											>
												{isCompletedStatus(interview.status) ? "Completed" : interview.status}
											</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<button
												type="button"
												onClick={() => {
													setSelectedInterview(interview);
													setViewMode("timeline");
												}}
												className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
											>
												View Details
												<ChevronRight className="w-4 h-4" />
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
}
