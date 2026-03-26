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

const createEmptyQuestion = (category = categories[0]) => ({
	question: "",
	answer: "",
	category,
	company: "",
	role: "",
});

const getErrorMessage = (error) => error?.message || "unknown error";

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

// Simple in-memory cache to avoid refetching interview questions on repeated mounts
let cachedInterviewQuestions = null;

export function InterviewQuestions() {
	const [questions, setQuestions] = useState([]);
	const [searchTerm, setSearchTerm] = useState("");
	const [showAddForm, setShowAddForm] = useState(false);
	const [editingId, setEditingId] = useState(null);
	const [expandedQuestions, setExpandedQuestions] = useState({});
	const [newQuestion, setNewQuestion] = useState(() => createEmptyQuestion());
	const [errors, setErrors] = useState({});
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [pendingDeleteId, setPendingDeleteId] = useState(null);
	const [toastMessage, setToastMessage] = useState("");
	const [showToast, setShowToast] = useState(false);
	const [savingQuestion, setSavingQuestion] = useState(false);
	const toastTimerRef = useRef(null);

	const [categoryFilter, setCategoryFilter] = useState("");
	const [companyFilter, setCompanyFilter] = useState("");

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

	const resetQuestionForm = useCallback((category = categories[0]) => {
		setNewQuestion(createEmptyQuestion(category));
		setErrors({});
	}, []);

	const closeQuestionForm = useCallback(() => {
		setShowAddForm(false);
		setEditingId(null);
		resetQuestionForm();
	}, [resetQuestionForm]);

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setNewQuestion((prev) => ({ ...prev, [name]: value }));
		setErrors((prev) => ({ ...prev, [name]: "" }));
	};

	const handleAnswerChange = (value) => {
		setNewQuestion((prev) => ({ ...prev, answer: value }));
		setErrors((prev) => ({ ...prev, answer: "" }));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
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
				setEditingId(null);
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
			}

			closeQuestionForm();
		} catch (err) {
			console.error("Save failed", err);
			window.alert(`Failed to save question: ${getErrorMessage(err)}`);
		} finally {
			setSavingQuestion(false);
		}
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

	const handleAddForCategory = (category) => {
		setEditingId(null);
		resetQuestionForm(category);
		setShowAddForm(true);
	};

	const handleDelete = (id) => {
		setPendingDeleteId(id);
		setShowDeleteModal(true);
	};
	const confirmDelete = async () => {
		if (pendingDeleteId == null) return;
		const deletedText = questions.find((q) => q.id === pendingDeleteId)?.question;
		try {
			const resp = await fetch(`/api/interview-questions/${pendingDeleteId}`, { method: "DELETE" });
			if (!resp.ok && resp.status !== 204) {
				let body = "";
				try {
					body = await resp.text();
				} catch (_error) {
					/* ignore */
				}
				throw new Error(`Delete failed: ${resp.status} ${resp.statusText} ${body}`);
			}
			// refresh list from server to ensure consistent state
			try {
				const listResp = await fetch("/api/interview-questions");
				if (listResp.ok) {
					const data = await listResp.json();
					const normalized = normalizeQuestions(data);
					cachedInterviewQuestions = normalized;
					setQuestions(normalized);
				} else {
					const next = questions.filter((q) => q.id !== pendingDeleteId);
					cachedInterviewQuestions = next;
					setQuestions(next);
				}
			} catch (_error) {
				const next = questions.filter((q) => q.id !== pendingDeleteId);
				cachedInterviewQuestions = next;
				setQuestions(next);
			}
			setExpandedQuestions((prev) => {
				const updated = { ...prev };
				delete updated[pendingDeleteId];
				return updated;
			});
			setPendingDeleteId(null);
			setShowDeleteModal(false);
			// show toast message
			const msg = deletedText ? `Deleted Successfully: ${deletedText}` : "Question deleted";
			setToastMessage(msg);
			setShowToast(true);
			if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
			toastTimerRef.current = setTimeout(() => setShowToast(false), 3000);
		} catch (err) {
			console.error("Delete failed", err);
			window.alert(`Failed to delete question: ${getErrorMessage(err)}`);
		}
	};
	const cancelDelete = () => {
		setPendingDeleteId(null);
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

								<div className="flex justify-end pt-4 gap-6">
									<button
										type="button"
										disabled={savingQuestion}
										onClick={closeQuestionForm}
										className="cursor-pointer px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										Cancel
									</button>
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
											<span>{editingId ? "Update Question" : "Add Question"}</span>
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
							<h3 className="text-lg font-semibold mb-2">Delete Question</h3>
							<p className="text-sm text-gray-600 mb-4">
								Are you sure you want to delete this question? This will remove the question from
								your saved list.
							</p>

							{pendingDeleteId != null && (
								<div className="mb-4 p-3 bg-gray-50 rounded text-sm text-gray-800 font-medium">
									{questions.find((q) => q.id === pendingDeleteId)?.question}
								</div>
							)}

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
