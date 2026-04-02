import { createElement, useState, useEffect, useMemo, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { Plus, X, ChevronDown, ChevronUp, Edit, Trash2, ArrowUp, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { RichTextEditor } from "./RichTextEditor";
import {
	answerHasContent,
	answerToPlainText,
	prepareAnswerForEditor,
	renderAnswerHtml,
} from "../utils/interviewAnswerFormat";

const categories = [
	"Architecture",
	"Behavioral",
	"Change Management",
	"Communication",
	"Collaboration",
	"Company Culture",
	"Delivery",
	"General",
	"Leadership",
	"Metrics and Reports",
	"Operational Support",
	"Project Management",
	"Project or Team Health",
	"Problem Solving",
	"Performance Optimization",
	"Risk Management",
	"Role Specific",
	"Stakeholder Management",
	"System Design",
	"Technical",
	"Team Management",
];

const formFieldIds = {
	category: "interview-question-category",
	company: "interview-question-company",
	role: "interview-question-role",
	question: "interview-question-question",
	answer: "interview-question-answer",
};

const interviewerFormFieldIds = {
	company: "interviewer-question-company",
	role: "interviewer-question-role",
	question: "interviewer-question-question",
};

const createEmptyQuestion = (category = categories[0]) => ({
	question: "",
	answer: "",
	category,
	company: "",
	role: "",
});

const createEmptyInterviewerQuestion = () => ({
	question: "",
	company: "",
	role: "",
});

const getErrorMessage = (error) => error?.message || "unknown error";
const formActionRowStyle = { columnGap: "2rem", rowGap: "0.75rem" };
const focusFieldOnNextFrame = (inputRef) => {
	if (typeof window === "undefined") return;
	window.requestAnimationFrame(() => {
		inputRef.current?.focus();
	});
};

const renderAnswerNode = (node, key) => {
	if (node.nodeType === Node.TEXT_NODE) return node.textContent;
	if (node.nodeType !== Node.ELEMENT_NODE) return null;

	const element = node;
	const children = Array.from(element.childNodes)
		.map((child, index) => renderAnswerNode(child, `${key}-${index}`))
		.filter((child) => child !== null);

	switch (element.tagName.toUpperCase()) {
		case "P":
			return createElement("p", { key }, children);
		case "UL":
			return createElement("ul", { key }, children);
		case "OL":
			return createElement("ol", { key }, children);
		case "LI":
			return createElement("li", { key }, children);
		case "STRONG":
			return createElement("strong", { key }, children);
		case "EM":
			return createElement("em", { key }, children);
		case "U":
			return createElement("u", { key }, children);
		case "CODE":
			return createElement("code", { key }, children);
		case "BLOCKQUOTE":
			return createElement("blockquote", { key }, children);
		case "SPAN":
			return createElement(
				"span",
				{
					key,
					style: element.style.fontSize ? { fontSize: element.style.fontSize } : undefined,
				},
				children,
			);
		case "BR":
			return createElement("br", { key });
		default:
			return null;
	}
};

const renderAnswerContent = (html) => {
	if (!html || typeof window === "undefined" || typeof window.document === "undefined") return null;
	const doc = window.document.implementation.createHTMLDocument("");
	doc.body.innerHTML = html;
	return Array.from(doc.body.childNodes)
		.map((child, index) => renderAnswerNode(child, `answer-node-${index}`))
		.filter((child) => child !== null);
};

const normalizeQuestion = (row) => {
	const question = row || {};
	const answer = question.answer || "";
	return {
		...question,
		answer,
		htmlAnswer: renderAnswerHtml(answer),
		plainAnswer: answerToPlainText(answer),
	};
};

const normalizeQuestions = (rows) =>
	(Array.isArray(rows) ? rows : []).map((row) => normalizeQuestion(row));

const normalizeInterviewerQuestion = (row) => ({
	...(row || {}),
	question: row?.question || "",
	company: row?.company || "",
	role: row?.role || "",
});

const normalizeInterviewerQuestions = (rows) =>
	(Array.isArray(rows) ? rows : []).map((row) => normalizeInterviewerQuestion(row));

// Simple in-memory cache to avoid refetching interview questions on repeated mounts
let cachedInterviewQuestions = null;
let cachedInterviewerQuestions = null;
const questionTabs = [
	{ id: "answers", label: "Questions and Answers" },
	{ id: "interviewer", label: "Questions to Interviewer" },
];

export function InterviewQuestions() {
	const [questions, setQuestions] = useState([]);
	const [interviewerQuestions, setInterviewerQuestions] = useState([]);
	const [activeQuestionTab, setActiveQuestionTab] = useState(questionTabs[0].id);
	const [searchTerm, setSearchTerm] = useState("");
	const [interviewerSearchTerm, setInterviewerSearchTerm] = useState("");
	const [showAddForm, setShowAddForm] = useState(false);
	const [showAddInterviewerForm, setShowAddInterviewerForm] = useState(false);
	const [editingId, setEditingId] = useState(null);
	const [editingInterviewerId, setEditingInterviewerId] = useState(null);
	const [expandedQuestions, setExpandedQuestions] = useState({});
	const [newQuestion, setNewQuestion] = useState(() => createEmptyQuestion());
	const [newInterviewerQuestion, setNewInterviewerQuestion] = useState(() =>
		createEmptyInterviewerQuestion(),
	);
	const [errors, setErrors] = useState({});
	const [interviewerErrors, setInterviewerErrors] = useState({});
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [pendingDelete, setPendingDelete] = useState(null);
	const [toastMessage, setToastMessage] = useState("");
	const [showToast, setShowToast] = useState(false);
	const [savingQuestion, setSavingQuestion] = useState(false);
	const [savingInterviewerQuestion, setSavingInterviewerQuestion] = useState(false);
	const toastTimerRef = useRef(null);
	const questionInputRef = useRef(null);
	const interviewerQuestionInputRef = useRef(null);

	const [categoryFilter, setCategoryFilter] = useState("");
	const [companyFilter, setCompanyFilter] = useState("");
	const [interviewerCompanyFilter, setInterviewerCompanyFilter] = useState("");
	const [interviewerRoleFilter, setInterviewerRoleFilter] = useState("");

	useEffect(() => {
		return () => {
			if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
		};
	}, []);

	const availableCategories = useMemo(
		() => Array.from(new Set((questions || []).map((q) => q.category).filter(Boolean))).sort(),
		[questions],
	);
	const availableCompanies = useMemo(
		() =>
			Array.from(
				new Set((questions || []).map((q) => (q.company || "").trim()).filter(Boolean)),
			).sort(),
		[questions],
	);
	const availableInterviewerCompanies = useMemo(
		() =>
			Array.from(
				new Set((interviewerQuestions || []).map((q) => (q.company || "").trim()).filter(Boolean)),
			).sort(),
		[interviewerQuestions],
	);
	const availableInterviewerRoles = useMemo(
		() =>
			Array.from(
				new Set((interviewerQuestions || []).map((q) => (q.role || "").trim()).filter(Boolean)),
			).sort(),
		[interviewerQuestions],
	);

	const filteredQuestions = useMemo(
		() =>
			questions.filter((q) => {
				if (categoryFilter && q.category !== categoryFilter) return false;
				if (companyFilter && (q.company || "").trim() !== companyFilter) return false;
				const searchString =
					`${q.question} ${q.plainAnswer || ""} ${q.category} ${q.company || ""} ${q.role || ""}`.toLowerCase();
				return searchString.includes(searchTerm.toLowerCase());
			}),
		[questions, searchTerm, categoryFilter, companyFilter],
	);
	const filteredInterviewerQuestions = useMemo(
		() =>
			interviewerQuestions.filter((q) => {
				if (interviewerCompanyFilter && (q.company || "").trim() !== interviewerCompanyFilter) {
					return false;
				}
				if (interviewerRoleFilter && (q.role || "").trim() !== interviewerRoleFilter) return false;
				const searchString = `${q.question} ${q.company || ""} ${q.role || ""}`.toLowerCase();
				return searchString.includes(interviewerSearchTerm.toLowerCase());
			}),
		[
			interviewerQuestions,
			interviewerSearchTerm,
			interviewerCompanyFilter,
			interviewerRoleFilter,
		],
	);

	useEffect(() => {
		let mounted = true;

		const setFromRows = (rows) => {
			const normalized = normalizeQuestions(rows);
			if (mounted) setQuestions(normalized);
		};

		if (cachedInterviewQuestions) {
			setFromRows(cachedInterviewQuestions);
			return () => {
				mounted = false;
			};
		}

		async function load() {
			try {
				const resp = await fetch("/api/interview-questions");
				if (!resp.ok) throw new Error(`Failed to load: ${resp.status}`);
				const data = await resp.json();
				cachedInterviewQuestions = Array.isArray(data) ? data : [];
				setFromRows(cachedInterviewQuestions);
			} catch (err) {
				console.error("Failed to load interview questions", err);
			}
		}
		load();
		return () => {
			mounted = false;
		};
	}, []);
	useEffect(() => {
		let mounted = true;

		const setFromRows = (rows) => {
			const normalized = normalizeInterviewerQuestions(rows);
			if (mounted) setInterviewerQuestions(normalized);
		};

		if (cachedInterviewerQuestions) {
			setFromRows(cachedInterviewerQuestions);
			return () => {
				mounted = false;
			};
		}

		async function load() {
			try {
				const resp = await fetch("/api/interviewer-questions");
				if (!resp.ok) throw new Error(`Failed to load: ${resp.status}`);
				const data = await resp.json();
				cachedInterviewerQuestions = Array.isArray(data) ? data : [];
				setFromRows(cachedInterviewerQuestions);
			} catch (err) {
				console.error("Failed to load interviewer questions", err);
			}
		}
		load();
		return () => {
			mounted = false;
		};
	}, []);

	const groupedQuestions = useMemo(
		() =>
			filteredQuestions.reduce((acc, question) => {
				if (!acc[question.category]) acc[question.category] = [];
				acc[question.category].push(question);
				return acc;
			}, {}),
		[filteredQuestions],
	);

	const toggleQuestion = (id) => setExpandedQuestions((prev) => ({ ...prev, [id]: !prev[id] }));
	const expandAll = () => {
		const expanded = {};
		for (const q of filteredQuestions) {
			expanded[q.id] = true;
		}
		setExpandedQuestions(expanded);
	};
	const collapseAll = () => setExpandedQuestions({});

	const resetQuestionForm = useCallback((category = categories[0], preservedValues = {}) => {
		setNewQuestion({
			...createEmptyQuestion(category),
			company: preservedValues.company || "",
			role: preservedValues.role || "",
		});
		setErrors({});
	}, []);
	const resetInterviewerQuestionForm = useCallback((preservedValues = {}) => {
		setNewInterviewerQuestion({
			...createEmptyInterviewerQuestion(),
			company: preservedValues.company || "",
			role: preservedValues.role || "",
		});
		setInterviewerErrors({});
	}, []);

	const closeQuestionForm = useCallback(() => {
		setShowAddForm(false);
		setEditingId(null);
		resetQuestionForm();
	}, [resetQuestionForm]);
	const closeInterviewerQuestionForm = useCallback(() => {
		setShowAddInterviewerForm(false);
		setEditingInterviewerId(null);
		resetInterviewerQuestionForm();
	}, [resetInterviewerQuestionForm]);
	const showTemporaryToast = useCallback((message) => {
		setToastMessage(message);
		setShowToast(true);
		if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
		toastTimerRef.current = setTimeout(() => setShowToast(false), 3000);
	}, []);

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setNewQuestion((prev) => ({ ...prev, [name]: value }));
		setErrors((prev) => ({ ...prev, [name]: "" }));
	};
	const handleInterviewerInputChange = (e) => {
		const { name, value } = e.target;
		setNewInterviewerQuestion((prev) => ({ ...prev, [name]: value }));
		setInterviewerErrors((prev) => ({ ...prev, [name]: "" }));
	};

	const handleAnswerChange = (value) => {
		setNewQuestion((prev) => ({ ...prev, answer: value }));
		setErrors((prev) => ({ ...prev, answer: "" }));
	};

	const saveQuestion = async ({ closeAfterSave = true } = {}) => {
		const newErrors = {};
		if (!newQuestion.question?.trim()) newErrors.question = "Question is required";
		if (!answerHasContent(newQuestion.answer)) newErrors.answer = "Answer is required";
		if (!newQuestion.category) newErrors.category = "Category is required";
		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			return;
		}
		setSavingQuestion(true);
		try {
			const payload = {
				question: newQuestion.question,
				answer: prepareAnswerForEditor(newQuestion.answer),
				category: newQuestion.category,
				company: newQuestion.company,
				role: newQuestion.role,
			};
			let nextFormValues = null;

			if (editingId) {
				const resp = await fetch(`/api/interview-questions/${editingId}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
				if (!resp.ok) {
					let body = "";
					try {
						body = await resp.text();
					} catch (_error) {
						/* ignore */
					}
					throw new Error(body || `Failed to update (${resp.status})`);
				}
				const updated = await resp.json();
				const next = questions.map((q) => (q.id === editingId ? normalizeQuestion(updated) : q));
				cachedInterviewQuestions = next;
				setQuestions(next);
			} else {
				const resp = await fetch("/api/interview-questions", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
				if (!resp.ok) {
					let body = "";
					try {
						body = await resp.text();
					} catch (_error) {
						/* ignore */
					}
					throw new Error(body || `Failed to create (${resp.status})`);
				}
				const created = await resp.json();
				const next = [normalizeQuestion(created), ...questions];
				cachedInterviewQuestions = next;
				setQuestions(next);
				nextFormValues = {
					category: created.category || payload.category,
					company: created.company || payload.company || "",
					role: created.role || payload.role || "",
				};
			}

			if (closeAfterSave || editingId) {
				closeQuestionForm();
			} else {
				resetQuestionForm(nextFormValues?.category || payload.category, {
					company: nextFormValues?.company || "",
					role: nextFormValues?.role || "",
				});
				focusFieldOnNextFrame(questionInputRef);
			}
		} catch (err) {
			console.error("Save failed", err);
			window.alert(`Failed to save question: ${getErrorMessage(err)}`);
		} finally {
			setSavingQuestion(false);
		}
	};
	const handleSubmit = async (e) => {
		e.preventDefault();
		await saveQuestion();
	};
	const handleSaveAndAddMore = async () => {
		await saveQuestion({ closeAfterSave: false });
	};
	const saveInterviewerQuestion = async ({ closeAfterSave = true } = {}) => {
		const newErrors = {};
		if (!newInterviewerQuestion.question?.trim()) newErrors.question = "Question is required";
		if (Object.keys(newErrors).length > 0) {
			setInterviewerErrors(newErrors);
			return;
		}
		setSavingInterviewerQuestion(true);
		try {
			const payload = {
				question: newInterviewerQuestion.question,
				company: newInterviewerQuestion.company,
				role: newInterviewerQuestion.role,
			};
			let nextFormValues = null;

			if (editingInterviewerId) {
				const resp = await fetch(`/api/interviewer-questions/${editingInterviewerId}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
				if (!resp.ok) {
					let body = "";
					try {
						body = await resp.text();
					} catch (_error) {
						/* ignore */
					}
					throw new Error(body || `Failed to update (${resp.status})`);
				}
				const updated = await resp.json();
				const next = interviewerQuestions.map((q) =>
					q.id === editingInterviewerId ? normalizeInterviewerQuestion(updated) : q,
				);
				cachedInterviewerQuestions = next;
				setInterviewerQuestions(next);
			} else {
				const resp = await fetch("/api/interviewer-questions", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
				if (!resp.ok) {
					let body = "";
					try {
						body = await resp.text();
					} catch (_error) {
						/* ignore */
					}
					throw new Error(body || `Failed to create (${resp.status})`);
				}
				const created = await resp.json();
				const next = [normalizeInterviewerQuestion(created), ...interviewerQuestions];
				cachedInterviewerQuestions = next;
				setInterviewerQuestions(next);
				nextFormValues = {
					company: created.company || payload.company || "",
					role: created.role || payload.role || "",
				};
			}

			if (closeAfterSave || editingInterviewerId) {
				closeInterviewerQuestionForm();
			} else {
				resetInterviewerQuestionForm({
					company: nextFormValues?.company || "",
					role: nextFormValues?.role || "",
				});
				focusFieldOnNextFrame(interviewerQuestionInputRef);
			}
		} catch (err) {
			console.error("Save interviewer question failed", err);
			window.alert(`Failed to save interviewer question: ${getErrorMessage(err)}`);
		} finally {
			setSavingInterviewerQuestion(false);
		}
	};
	const handleInterviewerSubmit = async (e) => {
		e.preventDefault();
		await saveInterviewerQuestion();
	};
	const handleInterviewerSaveAndAddMore = async () => {
		await saveInterviewerQuestion({ closeAfterSave: false });
	};

	const handleEdit = (id) => {
		const q = questions.find((x) => x.id === id);
		if (!q) return;
		setNewQuestion({
			question: q.question,
			answer: prepareAnswerForEditor(q.answer),
			category: q.category,
			company: q.company || "",
			role: q.role || "",
		});
		setEditingId(id);
		setShowAddForm(true);
	};
	const handleInterviewerEdit = (id) => {
		const q = interviewerQuestions.find((x) => x.id === id);
		if (!q) return;
		setNewInterviewerQuestion({
			question: q.question,
			company: q.company || "",
			role: q.role || "",
		});
		setEditingInterviewerId(id);
		setShowAddInterviewerForm(true);
	};

	const handleAddForCategory = (category) => {
		setEditingId(null);
		resetQuestionForm(category);
		setShowAddForm(true);
	};
	const handleAddInterviewerQuestion = () => {
		setEditingInterviewerId(null);
		resetInterviewerQuestionForm();
		setShowAddInterviewerForm(true);
	};

	const handleDelete = (id) => {
		const question = questions.find((item) => item.id === id);
		setPendingDelete({ type: "answer", id, question: question?.question || "" });
		setShowDeleteModal(true);
	};
	const handleInterviewerDelete = (id) => {
		const question = interviewerQuestions.find((item) => item.id === id);
		setPendingDelete({ type: "interviewer", id, question: question?.question || "" });
		setShowDeleteModal(true);
	};
	const confirmDelete = async () => {
		if (!pendingDelete?.id) return;
		const isInterviewerQuestion = pendingDelete.type === "interviewer";
		const deletedText = pendingDelete.question;
		const endpoint = isInterviewerQuestion
			? `/api/interviewer-questions/${pendingDelete.id}`
			: `/api/interview-questions/${pendingDelete.id}`;
		const listEndpoint = isInterviewerQuestion
			? "/api/interviewer-questions"
			: "/api/interview-questions";
		try {
			const resp = await fetch(endpoint, { method: "DELETE" });
			if (!resp.ok && resp.status !== 204) {
				let body = "";
				try {
					body = await resp.text();
				} catch (_error) {
					/* ignore */
				}
				throw new Error(`Delete failed: ${resp.status} ${resp.statusText} ${body}`);
			}
			try {
				const listResp = await fetch(listEndpoint);
				if (listResp.ok) {
					const data = await listResp.json();
					if (isInterviewerQuestion) {
						const normalized = normalizeInterviewerQuestions(data);
						cachedInterviewerQuestions = normalized;
						setInterviewerQuestions(normalized);
					} else {
						const normalized = normalizeQuestions(data);
						cachedInterviewQuestions = normalized;
						setQuestions(normalized);
					}
				} else {
					if (isInterviewerQuestion) {
						const next = interviewerQuestions.filter((q) => q.id !== pendingDelete.id);
						cachedInterviewerQuestions = next;
						setInterviewerQuestions(next);
					} else {
						const next = questions.filter((q) => q.id !== pendingDelete.id);
						cachedInterviewQuestions = next;
						setQuestions(next);
					}
				}
			} catch (_error) {
				if (isInterviewerQuestion) {
					const next = interviewerQuestions.filter((q) => q.id !== pendingDelete.id);
					cachedInterviewerQuestions = next;
					setInterviewerQuestions(next);
				} else {
					const next = questions.filter((q) => q.id !== pendingDelete.id);
					cachedInterviewQuestions = next;
					setQuestions(next);
				}
			}
			if (!isInterviewerQuestion) {
				setExpandedQuestions((prev) => {
					const updated = { ...prev };
					delete updated[pendingDelete.id];
					return updated;
				});
			}
			setPendingDelete(null);
			setShowDeleteModal(false);
			showTemporaryToast(deletedText ? `Deleted Successfully: ${deletedText}` : "Question deleted");
		} catch (err) {
			console.error("Delete failed", err);
			window.alert(
				`Failed to delete ${isInterviewerQuestion ? "interviewer question" : "question"}: ${getErrorMessage(err)}`,
			);
		}
	};
	const cancelDelete = () => {
		setPendingDelete(null);
		setShowDeleteModal(false);
	};

	// Back-to-top button: visible once the user has scrolled past one viewport height
	const [showBackToTop, setShowBackToTop] = useState(false);
	useEffect(() => {
		const onScroll = () => {
			const scrolled =
				window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
			setShowBackToTop(scrolled >= window.innerHeight);
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
		};
	}, []);
	const scrollToTop = useCallback(() => {
		window.scrollTo({ top: 0, behavior: "smooth" });
		document.documentElement.scrollTop = 0;
	}, []);

	return (
		<div className="space-y-6">
			<div className="mb-2">
				<div className="overflow-x-auto pb-1">
					<div
						role="tablist"
						aria-label="Interview question sections"
						className="inline-flex min-w-max items-center gap-2 rounded-xl border border-gray-200 bg-gray-100 p-1"
					>
						{questionTabs.map((tab) => {
							const isActive = activeQuestionTab === tab.id;
							return (
								<button
									key={tab.id}
									type="button"
									role="tab"
									aria-selected={isActive}
									onClick={() => setActiveQuestionTab(tab.id)}
									className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
										isActive
											? "bg-white text-blue-700 shadow-sm"
											: "text-gray-600 hover:bg-white/60 hover:text-gray-900"
									}`}
								>
									{tab.label}
								</button>
							);
						})}
					</div>
				</div>
			</div>

			{activeQuestionTab === "answers" && (
				<>
					<div className="mb-6">
				<div className="flex flex-col gap-6">
					<div className="flex items-center justify-between">
						<h2 className="text-2xl font-bold text-gray-900">Interview Questions and Answers</h2>
						<button
							type="button"
							onClick={() => {
								setShowAddForm(true);
								setEditingId(null);
								resetQuestionForm();
							}}
							className="cursor-pointer flex items-center justify-center space-x-3 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 whitespace-nowrap"
						>
							<Plus className="h-5 w-5" />
							<span>Add Question</span>
						</button>
					</div>
					<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
						<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:gap-6">
							<div className="min-w-0 flex-1">
								<input
									type="text"
									placeholder="Search questions and answers..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="w-full rounded-md border border-gray-300 bg-white px-4 py-2"
								/>
							</div>

							<div className="flex min-w-0 max-w-full shrink-0 flex-nowrap items-center gap-6 overflow-x-auto">
								<span className="shrink-0 whitespace-nowrap text-sm font-medium text-gray-700">
									Filters:
								</span>
								<div className="w-56 shrink-0">
									<select
										value={categoryFilter}
										onChange={(e) => setCategoryFilter(e.target.value)}
										aria-label="Category"
										className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
									>
										<option value="">All categories</option>
										{availableCategories.map((cat) => (
											<option key={cat} value={cat}>
												{cat}
											</option>
										))}
									</select>
								</div>

								<div className="w-56 shrink-0">
									<select
										value={companyFilter}
										onChange={(e) => setCompanyFilter(e.target.value)}
										aria-label="Company"
										className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
									>
										<option value="">All companies</option>
										{availableCompanies.map((co) => (
											<option key={co} value={co}>
												{co}
											</option>
										))}
									</select>
								</div>

								<button
									type="button"
									onClick={() => {
										setSearchTerm("");
										setCategoryFilter("");
										setCompanyFilter("");
									}}
									className="inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm leading-normal text-gray-700 hover:bg-gray-100"
									aria-label="Clear search and filters"
								>
									<X className="h-4 w-4" />
									Clear All
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{filteredQuestions.length > 0 && (
				<div className="mb-4 flex justify-between items-center">
					<div className="text-md font-semibold text-gray-600">
						Showing {filteredQuestions.length} question{filteredQuestions.length !== 1 ? "s" : ""}
					</div>
					<div className="flex space-x-2">
						<button
							type="button"
							onClick={expandAll}
							className="cursor-pointer text-sm text-blue-600 hover:text-blue-800"
						>
							Expand All
						</button>
						<span className="text-gray-300">|</span>
						<button
							type="button"
							onClick={collapseAll}
							className="cursor-pointer text-sm text-blue-600 hover:text-blue-800"
						>
							Collapse All
						</button>
					</div>
				</div>
			)}

			{filteredQuestions.length === 0 ? (
				<div className="text-center py-12 text-gray-500">
					{searchTerm
						? "No questions found matching your search."
						: "No questions yet. Add your first question!"}
				</div>
			) : (
				<div className="space-y-6">
					{Object.keys(groupedQuestions)
						.sort()
						.map((category) => (
							<div key={category}>
								<div className="flex items-center justify-between mb-3">
									<h3 className="text-lg font-semibold text-gray-900">{category}</h3>
									<div className="ml-4">
										<button
											type="button"
											onClick={() => handleAddForCategory(category)}
											className="cursor-pointer text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 mb-4"
										>
											Add
										</button>
									</div>
								</div>
								<div className="space-y-2">
									{groupedQuestions[category].map((question) => (
										<motion.div
											key={question.id}
											initial={{ opacity: 0 }}
											animate={{ opacity: 1 }}
											className="border border-gray-200 rounded-lg hover:shadow-md transition-shadow overflow-hidden"
											style={{
												borderBottomLeftRadius: expandedQuestions[question.id] ? "0px" : undefined,
												borderBottomRightRadius: expandedQuestions[question.id] ? "0px" : undefined,
											}}
										>
											<div
												className="bg-gray-50 rounded-t-lg overflow-hidden px-4 py-3 flex justify-between items-center hover:bg-gray-100"
												style={{
													borderTopLeftRadius: "0.5rem",
													borderTopRightRadius: "0.5rem",
													borderBottomLeftRadius: expandedQuestions[question.id] ? "0px" : "0.5rem",
													borderBottomRightRadius: expandedQuestions[question.id]
														? "0px"
														: "0.5rem",
												}}
											>
												<button
													type="button"
													onClick={() => toggleQuestion(question.id)}
													className="flex min-w-0 flex-1 cursor-pointer items-center space-x-4 pl-2 text-left"
												>
													{expandedQuestions[question.id] ? (
														<ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0 mr-1 chevron-fixed" />
													) : (
														<ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0 mr-1 chevron-fixed" />
													)}
													<div className="min-w-0">
														<div className="font-medium text-gray-900 truncate">
															{question.question}
														</div>
														{question.company || question.role ? (
															<div className="text-sm text-gray-500 truncate">
																{question.company ? question.company : ""}
																{question.role
																	? question.company
																		? ` (${question.role})`
																		: `(${question.role})`
																	: ""}
															</div>
														) : null}
													</div>
												</button>

												<div className="flex items-center space-x-2 ml-4">
													<button
														type="button"
														onClick={(event) => {
															event.stopPropagation();
															handleEdit(question.id);
														}}
														className="cursor-pointer p-1 text-blue-600 hover:bg-blue-50 rounded"
														title="Edit question"
													>
														<Edit className="h-4 w-4" />
													</button>
													<button
														type="button"
														onClick={(event) => {
															event.stopPropagation();
															handleDelete(question.id);
														}}
														className="cursor-pointer p-1 text-red-600 hover:bg-red-50 rounded"
														title="Delete question"
													>
														<Trash2 className="h-4 w-4" />
													</button>
												</div>
											</div>

											{expandedQuestions[question.id] && (
												<motion.div
													initial={{ height: 0, opacity: 0 }}
													animate={{ height: "auto", opacity: 1 }}
													exit={{ height: 0, opacity: 0 }}
													transition={{ duration: 0.2 }}
													className="bg-white px-4 py-4 border-t border-gray-200 rounded-b-lg"
												>
													<div className="interview-answer-content text-gray-700">
														{renderAnswerContent(
															question.htmlAnswer || renderAnswerHtml(question.answer),
														)}
													</div>
												</motion.div>
											)}
										</motion.div>
									))}
								</div>
							</div>
						))}
				</div>
			)}
				</>
			)}

			{activeQuestionTab === "interviewer" && (
				<div>
				<div className="mb-6">
					<div className="flex flex-col gap-6">
						<div className="flex items-center justify-between">
							<div>
								<h2 className="text-2xl font-bold text-gray-900">Questions to Interviewer</h2>
								<p className="mt-1 text-sm text-gray-600">
									Store the questions you want to ask the interviewer. This section does not
									include answers.
								</p>
							</div>
							<button
								type="button"
								onClick={handleAddInterviewerQuestion}
								className="cursor-pointer flex items-center justify-center space-x-3 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 whitespace-nowrap"
							>
								<Plus className="h-5 w-5" />
								<span>Add Question</span>
							</button>
						</div>
						<div className="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
							<div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:gap-6">
								<div className="min-w-0 flex-1">
									<input
										type="text"
										placeholder="Search interviewer questions..."
										value={interviewerSearchTerm}
										onChange={(e) => setInterviewerSearchTerm(e.target.value)}
										className="w-full rounded-md border border-gray-300 bg-white px-4 py-2"
									/>
								</div>

								<div className="flex min-w-0 max-w-full shrink-0 flex-nowrap items-center gap-6 overflow-x-auto">
									<span className="shrink-0 whitespace-nowrap text-sm font-medium text-gray-700">
										Filters:
									</span>
									<div className="w-56 shrink-0">
										<select
											value={interviewerCompanyFilter}
											onChange={(e) => setInterviewerCompanyFilter(e.target.value)}
											aria-label="Interviewer question company"
											className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
										>
											<option value="">All companies</option>
											{availableInterviewerCompanies.map((company) => (
												<option key={company} value={company}>
													{company}
												</option>
											))}
										</select>
									</div>

									<div className="w-56 shrink-0">
										<select
											value={interviewerRoleFilter}
											onChange={(e) => setInterviewerRoleFilter(e.target.value)}
											aria-label="Interviewer question role"
											className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
										>
											<option value="">All roles</option>
											{availableInterviewerRoles.map((role) => (
												<option key={role} value={role}>
													{role}
												</option>
											))}
										</select>
									</div>

									<button
										type="button"
										onClick={() => {
											setInterviewerSearchTerm("");
											setInterviewerCompanyFilter("");
											setInterviewerRoleFilter("");
										}}
										className="inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm leading-normal text-gray-700 hover:bg-gray-100"
										aria-label="Clear interviewer question search and filters"
									>
										<X className="h-4 w-4" />
										Clear All
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>

				{filteredInterviewerQuestions.length > 0 && (
					<div className="mb-4 text-md font-semibold text-gray-600">
						Showing {filteredInterviewerQuestions.length} question
						{filteredInterviewerQuestions.length !== 1 ? "s" : ""}
					</div>
				)}

				{filteredInterviewerQuestions.length === 0 ? (
					<div className="text-center py-12 text-gray-500">
						{interviewerSearchTerm || interviewerCompanyFilter || interviewerRoleFilter
							? "No interviewer questions found matching your search."
							: "No interviewer questions yet. Add your first question!"}
					</div>
				) : (
					<div className="space-y-2">
						{filteredInterviewerQuestions.map((question) => (
							<motion.div
								key={question.id}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
							>
								<div className="flex items-start justify-between gap-4">
									<div className="min-w-0">
										<div className="font-medium text-gray-900">{question.question}</div>
										{question.company || question.role ? (
											<div className="mt-1 text-sm text-gray-500">
												{question.company ? question.company : ""}
												{question.role
													? question.company
														? ` (${question.role})`
														: question.role
													: ""}
											</div>
										) : null}
									</div>
									<div className="flex items-center space-x-2">
										<button
											type="button"
											onClick={() => handleInterviewerEdit(question.id)}
											className="cursor-pointer p-1 text-blue-600 hover:bg-blue-50 rounded"
											title="Edit interviewer question"
										>
											<Edit className="h-4 w-4" />
										</button>
										<button
											type="button"
											onClick={() => handleInterviewerDelete(question.id)}
											className="cursor-pointer p-1 text-red-600 hover:bg-red-50 rounded"
											title="Delete interviewer question"
										>
											<Trash2 className="h-4 w-4" />
										</button>
									</div>
								</div>
							</motion.div>
						))}
					</div>
				)}
				</div>
			)}

			{showAddForm && (
				<div
					className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/10"
					style={{ backdropFilter: "blur(6px)" }}
				>
					<motion.div
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						className="bg-white rounded-lg shadow-xl mx-auto overflow-y-auto"
						style={{ width: "min(92vw, 1120px)", maxHeight: "90vh" }}
					>
						<div className="p-6">
							<div className="flex justify-between items-center mb-6">
								<h2 className="text-xl font-semibold">
									{editingId ? "Edit Question" : "Add New Question and Answer"}
								</h2>
								<button
									type="button"
									disabled={savingQuestion}
									onClick={closeQuestionForm}
									className="cursor-pointer text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
								>
									<X className="h-6 w-6" />
								</button>
							</div>

							<form onSubmit={handleSubmit} className="space-y-4">
								<div>
									<label
										htmlFor={formFieldIds.category}
										className="block text-sm font-medium text-gray-700 mb-1"
									>
										Category *
									</label>
									<select
										id={formFieldIds.category}
										name="category"
										value={newQuestion.category}
										onChange={handleInputChange}
										className={`w-full border rounded-md px-3 py-2 ${errors.category ? "border-red-500" : ""}`}
									>
										{categories.map((cat) => (
											<option key={cat} value={cat}>
												{cat}
											</option>
										))}
									</select>
									{errors.category && (
										<p className="text-red-500 text-sm mt-1">{errors.category}</p>
									)}
								</div>

								<div>
									<label
										htmlFor={formFieldIds.company}
										className="block text-sm font-medium text-gray-700 mb-1"
									>
										Company (optional)
									</label>
									<input
										id={formFieldIds.company}
										name="company"
										value={newQuestion.company}
										onChange={handleInputChange}
										placeholder="Company name (optional)"
										disabled={savingQuestion}
										className="w-full border rounded-md px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
									/>
								</div>

								<div>
									<label
										htmlFor={formFieldIds.role}
										className="block text-sm font-medium text-gray-700 mb-1"
									>
										Role (optional)
									</label>
									<input
										id={formFieldIds.role}
										name="role"
										value={newQuestion.role}
										onChange={handleInputChange}
										placeholder="Role or job title (optional)"
										className="w-full border rounded-md px-3 py-2"
									/>
								</div>

								<div>
									<label
										htmlFor={formFieldIds.question}
										className="block text-sm font-medium text-gray-700 mb-1"
									>
										Question *
									</label>
									<textarea
										id={formFieldIds.question}
										ref={questionInputRef}
										name="question"
										value={newQuestion.question}
										onChange={handleInputChange}
										rows={3}
										placeholder="Enter your interview question..."
										disabled={savingQuestion}
										className={`w-full border rounded-md px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed ${errors.question ? "border-red-500" : ""}`}
									/>
									{errors.question && (
										<p className="text-red-500 text-sm mt-1">{errors.question}</p>
									)}
								</div>

								<div>
									<label
										htmlFor={formFieldIds.answer}
										className="block text-sm font-medium text-gray-700 mb-1"
									>
										Answer *
									</label>
									<RichTextEditor
										inputId={formFieldIds.answer}
										value={newQuestion.answer}
										onChange={handleAnswerChange}
										placeholder="Enter your prepared answer..."
										disabled={savingQuestion}
										hasError={Boolean(errors.answer)}
									/>
									{errors.answer && <p className="text-red-500 text-sm mt-1">{errors.answer}</p>}
								</div>

								<div
									className="flex flex-wrap justify-end pt-4"
									style={formActionRowStyle}
								>
									<button
										type="button"
										disabled={savingQuestion}
										onClick={closeQuestionForm}
										className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										Cancel
									</button>
									{!editingId && (
										<button
											type="button"
											disabled={savingQuestion}
											onClick={handleSaveAndAddMore}
											className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-blue-200 px-4 py-2 text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
										>
											Save and Add more
										</button>
									)}
									<button
										type="submit"
										disabled={savingQuestion}
										className="inline-flex min-w-[10.5rem] cursor-pointer items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-80"
									>
										{savingQuestion ? (
											<>
												<Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
												<span>{editingId ? "Updating…" : "Saving…"}</span>
											</>
										) : (
											<span>{editingId ? "Update Question" : "Save and Close"}</span>
										)}
									</button>
								</div>
							</form>
						</div>
					</motion.div>
				</div>
			)}

			{showAddInterviewerForm && (
				<div
					className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/10"
					style={{ backdropFilter: "blur(6px)" }}
				>
					<motion.div
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						className="bg-white rounded-lg shadow-xl mx-auto overflow-y-auto"
						style={{ width: "min(92vw, 840px)", maxHeight: "90vh" }}
					>
						<div className="p-6">
							<div className="flex justify-between items-center mb-6">
								<h2 className="text-xl font-semibold">
									{editingInterviewerId
										? "Edit Question to Interviewer"
										: "Add Question to Interviewer"}
								</h2>
								<button
									type="button"
									disabled={savingInterviewerQuestion}
									onClick={closeInterviewerQuestionForm}
									className="cursor-pointer text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
								>
									<X className="h-6 w-6" />
								</button>
							</div>

							<form onSubmit={handleInterviewerSubmit} className="space-y-4">
								<div>
									<label
										htmlFor={interviewerFormFieldIds.company}
										className="block text-sm font-medium text-gray-700 mb-1"
									>
										Company (optional)
									</label>
									<input
										id={interviewerFormFieldIds.company}
										name="company"
										value={newInterviewerQuestion.company}
										onChange={handleInterviewerInputChange}
										placeholder="Company name (optional)"
										disabled={savingInterviewerQuestion}
										className="w-full border rounded-md px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
									/>
								</div>

								<div>
									<label
										htmlFor={interviewerFormFieldIds.role}
										className="block text-sm font-medium text-gray-700 mb-1"
									>
										Role (optional)
									</label>
									<input
										id={interviewerFormFieldIds.role}
										name="role"
										value={newInterviewerQuestion.role}
										onChange={handleInterviewerInputChange}
										placeholder="Role or job title (optional)"
										disabled={savingInterviewerQuestion}
										className="w-full border rounded-md px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
									/>
								</div>

								<div>
									<label
										htmlFor={interviewerFormFieldIds.question}
										className="block text-sm font-medium text-gray-700 mb-1"
									>
										Question *
									</label>
									<textarea
										id={interviewerFormFieldIds.question}
										ref={interviewerQuestionInputRef}
										name="question"
										value={newInterviewerQuestion.question}
										onChange={handleInterviewerInputChange}
										rows={4}
										placeholder="Enter the question you want to ask the interviewer..."
										disabled={savingInterviewerQuestion}
										className={`w-full border rounded-md px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed ${interviewerErrors.question ? "border-red-500" : ""}`}
									/>
									{interviewerErrors.question && (
										<p className="text-red-500 text-sm mt-1">{interviewerErrors.question}</p>
									)}
								</div>

								<div
									className="flex flex-wrap justify-end pt-4"
									style={formActionRowStyle}
								>
									<button
										type="button"
										disabled={savingInterviewerQuestion}
										onClick={closeInterviewerQuestionForm}
										className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										Cancel
									</button>
									{!editingInterviewerId && (
										<button
											type="button"
											disabled={savingInterviewerQuestion}
											onClick={handleInterviewerSaveAndAddMore}
											className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-blue-200 px-4 py-2 text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
										>
											Save and Add more
										</button>
									)}
									<button
										type="submit"
										disabled={savingInterviewerQuestion}
										className="inline-flex min-w-[10.5rem] cursor-pointer items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-80"
									>
										{savingInterviewerQuestion ? (
											<>
												<Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
												<span>
													{editingInterviewerId ? "Updating..." : "Saving..."}
												</span>
											</>
										) : (
											<span>
												{editingInterviewerId ? "Update Question" : "Save and Close"}
											</span>
										)}
									</button>
								</div>
							</form>
						</div>
					</motion.div>
				</div>
			)}

			{showDeleteModal && (
				<div
					className="fixed inset-0 flex items-center justify-center p-6 z-50 bg-black/20"
					style={{ backdropFilter: "blur(6px)" }}
				>
					<motion.div
						initial={{ opacity: 0, scale: 0.98 }}
						animate={{ opacity: 1, scale: 1 }}
						className="bg-white rounded-lg shadow-xl mx-auto border"
						style={{ width: "33vw", minWidth: "360px", maxWidth: "900px" }}
					>
						<div className="p-6">
							<h3 className="text-lg font-semibold mb-2">
								Delete {pendingDelete?.type === "interviewer" ? "Question to Interviewer" : "Question"}
							</h3>
							<p className="text-sm text-gray-600 mb-4">
								Are you sure you want to delete this question? This will remove the question from
								your saved list.
							</p>

							{pendingDelete?.question ? (
								<div className="mb-4 p-3 bg-gray-50 rounded text-sm text-gray-800 font-medium">
									{pendingDelete.question}
								</div>
							) : null}

							<div className="border-t border-gray-200 mt-4 pt-4 flex justify-end items-center gap-6">
								<button
									type="button"
									onClick={cancelDelete}
									className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 bg-white"
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={confirmDelete}
									className="cursor-pointer px-4 py-2 border border-red-600 text-red-600 rounded-md hover:bg-red-50 bg-white"
								>
									Delete
								</button>
							</div>
						</div>
					</motion.div>
				</div>
			)}

			{/* Floating back-to-top button rendered via portal on document.body */}
			{showBackToTop &&
				ReactDOM.createPortal(
					<button
						type="button"
						onClick={scrollToTop}
						aria-label="Back to top"
						style={{
							position: "fixed",
							bottom: "40px",
							right: "40px",
							zIndex: 99999,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							width: "48px",
							height: "48px",
							padding: 0,
							borderRadius: "50%",
							backgroundColor: "#2563eb",
							color: "#fff",
							border: "none",
							cursor: "pointer",
							boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = "#1d4ed8";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = "#2563eb";
						}}
					>
						<ArrowUp style={{ width: 20, height: 20 }} />
					</button>,
					document.body,
				)}
			{/* Toast message (center bottom) */}
			{showToast &&
				ReactDOM.createPortal(
					<div
						style={{
							position: "fixed",
							left: "50%",
							transform: "translateX(-50%)",
							bottom: "24px",
							zIndex: 99999,
						}}
					>
						<div
							style={{
								background: "rgba(17,24,39,0.95)",
								color: "white",
								padding: "10px 16px",
								borderRadius: 8,
								boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
								maxWidth: "85vw",
								textAlign: "center",
								fontSize: 14,
							}}
						>
							{toastMessage}
						</div>
					</div>,
					document.body,
				)}
		</div>
	);
}
