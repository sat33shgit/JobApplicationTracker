import { renderAnswerHtml } from "./interviewAnswerFormat";

const COLORS = {
	ink: [15, 23, 42],
	accent: [30, 64, 175],
	muted: [100, 116, 139],
	rule: [226, 232, 240],
};

const PAGE = {
	marginLeft: 52,
	marginRight: 52,
	marginTop: 66,
	marginBottom: 48,
	headerY: 32,
};

const normalizeText = (value) =>
	String(value || "")
		.replace(/\r\n/g, "\n")
		.replace(/\u00a0/g, " ")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

const createDocument = () => {
	if (typeof window === "undefined" || typeof window.document === "undefined") return null;
	return window.document.implementation.createHTMLDocument("");
};

const collectNodeText = (node) => {
	if (!node) return "";
	if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
	if (node.nodeType !== Node.ELEMENT_NODE) return "";

	const element = node;
	const tagName = element.tagName.toUpperCase();
	if (tagName === "BR") return "\n";

	const text = Array.from(element.childNodes).map(collectNodeText).join("");
	if (["P", "DIV", "LI", "BLOCKQUOTE"].includes(tagName)) return `${text}\n`;
	return text;
};

const extractAnswerBlocks = (answer) => {
	const html = renderAnswerHtml(answer || "");
	if (!html) return [];

	const doc = createDocument();
	if (!doc) {
		return normalizeText(answer)
			.split(/\n{2,}/)
			.map((text) => normalizeText(text))
			.filter(Boolean)
			.map((text) => ({ type: "paragraph", text }));
	}

	doc.body.innerHTML = html;
	const blocks = [];

	const pushParagraph = (node, type = "paragraph") => {
		const text = normalizeText(collectNodeText(node));
		if (text) blocks.push({ type, text });
	};

	for (const child of Array.from(doc.body.childNodes)) {
		if (child.nodeType === Node.TEXT_NODE) {
			pushParagraph(child);
			continue;
		}

		if (child.nodeType !== Node.ELEMENT_NODE) continue;

		const element = child;
		const tagName = element.tagName.toUpperCase();

		if (tagName === "UL" || tagName === "OL") {
			const items = Array.from(element.children)
				.map((item) => normalizeText(collectNodeText(item)))
				.filter(Boolean);
			if (items.length > 0) {
				blocks.push({
					type: "list",
					ordered: tagName === "OL",
					items,
				});
			}
			continue;
		}

		if (tagName === "BLOCKQUOTE") {
			pushParagraph(element, "quote");
			continue;
		}

		pushParagraph(element);
	}

	return blocks;
};

const getQuestionGroups = (questions) => {
	const groups = new Map();

	for (const question of Array.isArray(questions) ? questions : []) {
		const category = normalizeText(question?.category) || "Uncategorized";
		const existing = groups.get(category) || [];
		existing.push(question);
		groups.set(category, existing);
	}

	return Array.from(groups.entries())
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([category, items]) => ({ category, items }));
};

const getMetadataText = (item) => {
	const parts = [];
	const company = normalizeText(item?.company);
	const role = normalizeText(item?.role);

	if (company) parts.push(`Company: ${company}`);
	if (role) parts.push(`Role: ${role}`);

	return parts.join("   |   ");
};

const getGeneratedLabel = () =>
	new Intl.DateTimeFormat(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(new Date());

const getFileDate = () =>
	new Intl.DateTimeFormat("en-CA", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());

const createWriter = (doc) => {
	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();
	const maxY = pageHeight - PAGE.marginBottom;
	const contentWidth = pageWidth - PAGE.marginLeft - PAGE.marginRight;
	const state = { y: PAGE.marginTop };

	const addPage = () => {
		doc.addPage();
		state.y = PAGE.marginTop;
	};

	const ensureSpace = (height) => {
		if (state.y + height <= maxY) return;
		addPage();
	};

	const setTextStyle = (fontSize, fontStyle, color) => {
		doc.setFont("helvetica", fontStyle);
		doc.setFontSize(fontSize);
		doc.setTextColor(...color);
	};

	const writeWrappedText = (
		text,
		{
			fontSize = 10.5,
			fontStyle = "normal",
			color = COLORS.ink,
			indent = 0,
			after = 0,
			lineHeightFactor = 1.45,
		} = {},
	) => {
		const normalized = String(text || "");
		if (!normalized.trim()) {
			state.y += after;
			return;
		}

		setTextStyle(fontSize, fontStyle, color);
		const lineHeight = fontSize * lineHeightFactor;
		const x = PAGE.marginLeft + indent;
		const width = contentWidth - indent;
		const paragraphs = normalized.split("\n");

		for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
			const paragraph = paragraphs[paragraphIndex];
			const lines = paragraph
				? doc.splitTextToSize(paragraph, width)
				: [""];

			for (const line of lines) {
				ensureSpace(lineHeight);
				if (line) doc.text(String(line), x, state.y);
				state.y += lineHeight;
			}

			if (paragraphIndex < paragraphs.length - 1) {
				ensureSpace(lineHeight * 0.4);
				state.y += lineHeight * 0.4;
			}
		}

		state.y += after;
	};

	const writeListItem = (
		prefix,
		text,
		{
			fontSize = 10.5,
			fontStyle = "normal",
			color = COLORS.ink,
			indent = 20,
			after = 2,
			lineHeightFactor = 1.45,
		} = {},
	) => {
		const normalized = normalizeText(text);
		if (!normalized) {
			state.y += after;
			return;
		}

		setTextStyle(fontSize, fontStyle, color);
		const lineHeight = fontSize * lineHeightFactor;
		const prefixGap = 8;
		const prefixWidth = doc.getTextWidth(prefix) + prefixGap;
		const x = PAGE.marginLeft + indent;
		const lines = doc.splitTextToSize(normalized, contentWidth - indent - prefixWidth);

		for (let index = 0; index < lines.length; index += 1) {
			ensureSpace(lineHeight);
			if (index === 0) doc.text(prefix, x, state.y);
			doc.text(String(lines[index]), x + prefixWidth, state.y);
			state.y += lineHeight;
		}

		state.y += after;
	};

	const writeRule = ({ before = 2, after = 12 } = {}) => {
		ensureSpace(before + after + 2);
		state.y += before;
		doc.setDrawColor(...COLORS.rule);
		doc.setLineWidth(0.8);
		doc.line(PAGE.marginLeft, state.y, pageWidth - PAGE.marginRight, state.y);
		state.y += after;
	};

	const prepareSectionStart = (minimumHeight = 72) => {
		ensureSpace(minimumHeight);
		return doc.getNumberOfPages();
	};

	return {
		addPage,
		prepareSectionStart,
		state,
		writeListItem,
		writeRule,
		writeWrappedText,
	};
};

const renderSectionHeading = (writer, title, subtitle) => {
	writer.writeWrappedText(title, {
		fontSize: 18,
		fontStyle: "bold",
		color: COLORS.accent,
		after: 4,
		lineHeightFactor: 1.2,
	});
	if (subtitle) {
		writer.writeWrappedText(subtitle, {
			fontSize: 10,
			color: COLORS.muted,
			after: 8,
		});
	}
	writer.writeRule({ before: 0, after: 14 });
};

const renderCategoryHeading = (writer, category, count) => {
	writer.writeWrappedText(`${category} (${count})`, {
		fontSize: 13.5,
		fontStyle: "bold",
		color: COLORS.ink,
		after: 2,
		lineHeightFactor: 1.25,
	});
	writer.writeWrappedText(
		`${count} saved question${count === 1 ? "" : "s"} in this category`,
		{
			fontSize: 9.5,
			color: COLORS.muted,
			after: 8,
		},
	);
	writer.writeRule({ before: 0, after: 10 });
};

const renderAnswerBlocks = (writer, blocks) => {
	if (blocks.length === 0) {
		writer.writeWrappedText("No answer saved.", {
			fontSize: 10,
			color: COLORS.muted,
			indent: 12,
			after: 10,
		});
		return;
	}

	for (const block of blocks) {
		if (block.type === "list") {
			block.items.forEach((item, index) => {
				writer.writeListItem(block.ordered ? `${index + 1}.` : "-", item, {
					indent: 16,
					after: 2,
				});
			});
			writer.state.y += 4;
			continue;
		}

		if (block.type === "quote") {
			writer.writeWrappedText(block.text, {
				fontSize: 10.25,
				fontStyle: "italic",
				color: COLORS.muted,
				indent: 18,
				after: 8,
			});
			continue;
		}

		writer.writeWrappedText(block.text, {
			fontSize: 10.5,
			color: COLORS.ink,
			indent: 12,
			after: 8,
		});
	}
};

const renderQuestionBlock = (writer, question, index) => {
	writer.prepareSectionStart(92);
	writer.writeWrappedText(`Q${index}. ${normalizeText(question?.question) || "Untitled question"}`, {
		fontSize: 12.5,
		fontStyle: "bold",
		color: COLORS.ink,
		after: 4,
		lineHeightFactor: 1.25,
	});

	const metadata = getMetadataText(question);
	if (metadata) {
		writer.writeWrappedText(metadata, {
			fontSize: 9.5,
			color: COLORS.muted,
			after: 6,
		});
	}

	writer.writeWrappedText("Answer", {
		fontSize: 10,
		fontStyle: "bold",
		color: COLORS.accent,
		after: 4,
	});
	renderAnswerBlocks(writer, extractAnswerBlocks(question?.answer));
	writer.writeRule({ before: 0, after: 12 });
};

const renderInterviewerQuestionBlock = (writer, question, index) => {
	writer.prepareSectionStart(64);
	writer.writeWrappedText(
		`${index}. ${normalizeText(question?.question) || "Untitled interviewer question"}`,
		{
			fontSize: 11.5,
			fontStyle: "bold",
			color: COLORS.ink,
			after: 4,
			lineHeightFactor: 1.25,
		},
	);

	const metadata = getMetadataText(question);
	if (metadata) {
		writer.writeWrappedText(metadata, {
			fontSize: 9.5,
			color: COLORS.muted,
			after: 6,
		});
	}

	writer.writeRule({ before: 0, after: 10 });
};

const renderTableOfContents = (doc, tocEntries, questionCount, interviewerCount) => {
	doc.setPage(1);
	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();
	let y = 72;

	doc.setFont("helvetica", "bold");
	doc.setFontSize(22);
	doc.setTextColor(...COLORS.ink);
	doc.text("Interview Questions Export", PAGE.marginLeft, y);
	y += 26;

	doc.setFont("helvetica", "normal");
	doc.setFontSize(10.5);
	doc.setTextColor(...COLORS.muted);
	doc.text(`Generated ${getGeneratedLabel()}`, PAGE.marginLeft, y);
	y += 20;

	doc.text(
		`Questions and Answers: ${questionCount}   |   Questions to Interviewer: ${interviewerCount}`,
		PAGE.marginLeft,
		y,
	);
	y += 24;

	doc.setDrawColor(...COLORS.rule);
	doc.setLineWidth(0.8);
	doc.line(PAGE.marginLeft, y, pageWidth - PAGE.marginRight, y);
	y += 24;

	doc.setFont("helvetica", "bold");
	doc.setFontSize(15);
	doc.setTextColor(...COLORS.accent);
	doc.text("Table of Contents", PAGE.marginLeft, y);
	y += 24;

	for (const entry of tocEntries) {
		if (y > pageHeight - PAGE.marginBottom - 20) break;

		const left = PAGE.marginLeft + entry.level * 18;
		const right = pageWidth - PAGE.marginRight;
		const pageLabel = String(entry.page);
		const fontSize = entry.level === 0 ? 11 : 10;
		const lineHeight = doc.internal.getLineHeight() / doc.internal.scaleFactor;
		const rowHeight = entry.level === 0 ? 18 : 16;

		doc.setFont("helvetica", entry.level === 0 ? "bold" : "normal");
		doc.setFontSize(fontSize);
		doc.setTextColor(...COLORS.ink);
		doc.text(entry.label, left, y);
		doc.text(pageLabel, right, y, { align: "right" });

		const labelWidth = doc.getTextWidth(entry.label);
		const pageWidthText = doc.getTextWidth(pageLabel);
		const lineStart = left + labelWidth + 10;
		const lineEnd = right - pageWidthText - 10;
		if (lineEnd > lineStart) {
			doc.setDrawColor(...COLORS.rule);
			doc.line(lineStart, y - 3, lineEnd, y - 3);
		}

		doc.link(left, y - lineHeight * 0.8, right - left, rowHeight, {
			pageNumber: entry.page,
			top: PAGE.marginTop,
			zoom: 0,
		});

		y += rowHeight;
	}
};

const renderPageChrome = (doc) => {
	const totalPages = doc.getNumberOfPages();
	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();

	for (let page = 1; page <= totalPages; page += 1) {
		doc.setPage(page);

		doc.setFont("helvetica", "normal");
		doc.setFontSize(9);
		doc.setTextColor(...COLORS.muted);

		if (page > 1) {
			doc.text("Interview Questions Export", PAGE.marginLeft, PAGE.headerY);
			doc.setDrawColor(...COLORS.rule);
			doc.setLineWidth(0.8);
			doc.line(PAGE.marginLeft, 40, pageWidth - PAGE.marginRight, 40);
		}

		doc.line(
			PAGE.marginLeft,
			pageHeight - 30,
			pageWidth - PAGE.marginRight,
			pageHeight - 30,
		);
		doc.text("Job Application Tracker", PAGE.marginLeft, pageHeight - 16);
		doc.text(`Page ${page} of ${totalPages}`, pageWidth - PAGE.marginRight, pageHeight - 16, {
			align: "right",
		});
	}
};

export async function exportInterviewQuestionsPdf({ questions = [], interviewerQuestions = [] } = {}) {
	const totalQuestions = Array.isArray(questions) ? questions.length : 0;
	const totalInterviewerQuestions = Array.isArray(interviewerQuestions)
		? interviewerQuestions.length
		: 0;

	if (totalQuestions === 0 && totalInterviewerQuestions === 0) {
		throw new Error("There are no interview questions to export.");
	}

	const { jsPDF } = await import("jspdf");
	const doc = new jsPDF({
		orientation: "portrait",
		unit: "pt",
		format: "a4",
		compress: true,
	});
	const writer = createWriter(doc);
	const tocEntries = [];
	const questionGroups = getQuestionGroups(questions);

	writer.addPage();

	const questionsSectionPage = writer.prepareSectionStart(84);
	tocEntries.push({ label: "Questions and Answers", page: questionsSectionPage, level: 0 });
	renderSectionHeading(
		writer,
		"Questions and Answers",
		`${totalQuestions} saved question${totalQuestions === 1 ? "" : "s"} and answer${totalQuestions === 1 ? "" : "s"}`,
	);

	if (questionGroups.length === 0) {
		writer.writeWrappedText("No saved interview questions and answers.", {
			fontSize: 10.5,
			color: COLORS.muted,
			after: 10,
		});
	} else {
		let questionNumber = 1;
		for (const group of questionGroups) {
			const categoryPage = writer.prepareSectionStart(62);
			tocEntries.push({
				label: `${group.category} (${group.items.length})`,
				page: categoryPage,
				level: 1,
			});
			renderCategoryHeading(writer, group.category, group.items.length);

			for (const question of group.items) {
				renderQuestionBlock(writer, question, questionNumber);
				questionNumber += 1;
			}
		}
	}

	const interviewerSectionPage = writer.prepareSectionStart(84);
	tocEntries.push({
		label: "Questions to Interviewer",
		page: interviewerSectionPage,
		level: 0,
	});
	renderSectionHeading(
		writer,
		"Questions to Interviewer",
		`${totalInterviewerQuestions} saved question${totalInterviewerQuestions === 1 ? "" : "s"} for interviewers`,
	);

	if (totalInterviewerQuestions === 0) {
		writer.writeWrappedText("No saved interviewer questions.", {
			fontSize: 10.5,
			color: COLORS.muted,
			after: 10,
		});
	} else {
		interviewerQuestions.forEach((question, index) => {
			renderInterviewerQuestionBlock(writer, question, index + 1);
		});
	}

	renderTableOfContents(doc, tocEntries, totalQuestions, totalInterviewerQuestions);
	renderPageChrome(doc);

	const filename = `interview-questions-${getFileDate()}.pdf`;
	doc.save(filename);
	return filename;
}
