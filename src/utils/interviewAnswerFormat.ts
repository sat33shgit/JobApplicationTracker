import { normalizeNewlines } from "./text";

const RICH_TEXT_TAG_PATTERN = /<(p|br|ul|ol|li|strong|b|em|i|u|code|blockquote|div|span)(\s|>)/i;
const BLOCK_TAGS = new Set(["P", "UL", "OL", "BLOCKQUOTE"]);
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "HEAD"]);

const escapeHtml = (value: string): string =>
	String(value || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

const applyInlineFormatting = (value: string): string => {
	let formatted = escapeHtml(value);
	formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
	formatted = formatted.replace(/(^|[\s(])\*(.+?)\*(?=$|[\s).,!?:;])/g, "$1<em>$2</em>");
	formatted = formatted.replace(/`([^`]+?)`/g, "<code>$1</code>");
	return formatted;
};

const createDocument = (): Document | null => {
	if (typeof window === "undefined" || typeof window.document === "undefined") return null;
	return window.document.implementation.createHTMLDocument("");
};

const hasMeaningfulText = (value: string): boolean =>
	String(value || "")
		.replace(/\u00a0/g, " ")
		.trim().length > 0;

const isRichTextHtml = (value: string): boolean => RICH_TEXT_TAG_PATTERN.test(String(value || ""));

const sanitizeNode = (node: Node, doc: Document): Node | null => {
	if (node.nodeType === Node.TEXT_NODE) {
		return doc.createTextNode(node.textContent || "");
	}

	if (node.nodeType !== Node.ELEMENT_NODE) return null;

	const source = node as HTMLElement;
	const tagName = source.tagName.toUpperCase();
	if (SKIP_TAGS.has(tagName)) return null;

	if (tagName === "BODY") {
		const fragment = doc.createDocumentFragment();
		for (const child of Array.from(source.childNodes)) {
			const cleanChild = sanitizeNode(child, doc);
			if (cleanChild) fragment.appendChild(cleanChild);
		}
		return fragment;
	}

	if (tagName === "BR") return doc.createElement("br");

	const normalizedTag =
		tagName === "B" ? "STRONG" : tagName === "I" ? "EM" : tagName === "DIV" ? "P" : tagName;

	if (!["P", "UL", "OL", "LI", "STRONG", "EM", "U", "CODE", "BLOCKQUOTE"].includes(normalizedTag)) {
		const fragment = doc.createDocumentFragment();
		for (const child of Array.from(source.childNodes)) {
			const cleanChild = sanitizeNode(child, doc);
			if (cleanChild) fragment.appendChild(cleanChild);
		}
		return fragment;
	}

	const cleanElement = doc.createElement(normalizedTag.toLowerCase());
	for (const child of Array.from(source.childNodes)) {
		const cleanChild = sanitizeNode(child, doc);
		if (!cleanChild) continue;
		if (
			(normalizedTag === "UL" || normalizedTag === "OL") &&
			cleanChild.nodeType === Node.ELEMENT_NODE
		) {
			const childElement = cleanChild as HTMLElement;
			if (childElement.tagName.toUpperCase() !== "LI") {
				const li = doc.createElement("li");
				li.appendChild(cleanChild);
				cleanElement.appendChild(li);
				continue;
			}
		}
		cleanElement.appendChild(cleanChild);
	}

	if (normalizedTag === "LI") {
		const textContent = cleanElement.textContent || "";
		if (!hasMeaningfulText(textContent) && cleanElement.querySelector("br") === null) return null;
	}

	if (normalizedTag === "P" || normalizedTag === "BLOCKQUOTE") {
		const textContent = cleanElement.textContent || "";
		if (!hasMeaningfulText(textContent) && cleanElement.querySelector("br") === null) return null;
	}

	if ((normalizedTag === "UL" || normalizedTag === "OL") && cleanElement.children.length === 0) {
		return null;
	}

	return cleanElement;
};

const wrapInlineNodes = (nodes: Node[], doc: Document): HTMLElement | null => {
	if (nodes.length === 0) return null;
	const paragraph = doc.createElement("p");
	for (const node of nodes) {
		paragraph.appendChild(node);
	}
	const textContent = paragraph.textContent || "";
	if (!hasMeaningfulText(textContent) && paragraph.querySelector("br") === null) return null;
	return paragraph;
};

export const sanitizeAnswerHtml = (raw: string): string => {
	if (!raw) return "";
	const parserDoc = createDocument();
	if (!parserDoc) return normalizeNewlines(String(raw || ""));
	parserDoc.body.innerHTML = String(raw || "");

	const cleanDoc = createDocument();
	if (!cleanDoc) return normalizeNewlines(String(raw || ""));

	const container = cleanDoc.createElement("div");
	const inlineBuffer: Node[] = [];
	const flushInlineBuffer = () => {
		const paragraph = wrapInlineNodes(inlineBuffer.splice(0), cleanDoc);
		if (paragraph) container.appendChild(paragraph);
	};

	for (const child of Array.from(parserDoc.body.childNodes)) {
		const cleanChild = sanitizeNode(child, cleanDoc);
		if (!cleanChild) continue;

		const normalizedChildren =
			cleanChild.nodeType === Node.DOCUMENT_FRAGMENT_NODE
				? Array.from((cleanChild as DocumentFragment).childNodes)
				: [cleanChild];

		for (const normalizedChild of normalizedChildren) {
			if (
				normalizedChild.nodeType === Node.ELEMENT_NODE &&
				BLOCK_TAGS.has((normalizedChild as HTMLElement).tagName.toUpperCase())
			) {
				flushInlineBuffer();
				container.appendChild(normalizedChild);
				continue;
			}

			if (
				normalizedChild.nodeType === Node.ELEMENT_NODE &&
				(normalizedChild as HTMLElement).tagName.toUpperCase() === "LI"
			) {
				flushInlineBuffer();
				const list = cleanDoc.createElement("ul");
				list.appendChild(normalizedChild);
				container.appendChild(list);
				continue;
			}

			inlineBuffer.push(normalizedChild);
		}
	}

	flushInlineBuffer();
	return container.innerHTML.trim();
};

export const legacyTextToHtml = (raw: string): string => {
	if (!raw && raw !== "") return "";
	const normalized = normalizeNewlines(String(raw || ""));
	const blocks = normalized
		.split(/\n{2,}/g)
		.map((block) => block.trim())
		.filter(Boolean);
	if (blocks.length === 0) return "";

	return blocks
		.map((block) => {
			const lines = block
				.split("\n")
				.map((line) => line.trimEnd())
				.filter(Boolean);
			if (lines.length === 0) return "";

			const bulletItems = lines.map((line) => line.match(/^\s*[-*]\s+(.+)$/)?.[1] || null);
			if (bulletItems.every(Boolean)) {
				return `<ul>${bulletItems
					.map((item) => `<li>${applyInlineFormatting(item as string)}</li>`)
					.join("")}</ul>`;
			}

			const numberedItems = lines.map((line) => line.match(/^\s*\d+[.)]\s+(.+)$/)?.[1] || null);
			if (numberedItems.every(Boolean)) {
				return `<ol>${numberedItems
					.map((item) => `<li>${applyInlineFormatting(item as string)}</li>`)
					.join("")}</ol>`;
			}

			return `<p>${lines.map((line) => applyInlineFormatting(line)).join("<br/>")}</p>`;
		})
		.filter(Boolean)
		.join("");
};

export const renderAnswerHtml = (raw: string): string => {
	if (!raw && raw !== "") return "";
	return isRichTextHtml(raw) ? sanitizeAnswerHtml(raw) : legacyTextToHtml(raw);
};

export const prepareAnswerForEditor = (raw: string): string => renderAnswerHtml(raw);

export const answerToPlainText = (raw: string): string => {
	if (!raw) return "";
	const rendered = renderAnswerHtml(raw);
	const doc = createDocument();
	if (!doc) return normalizeNewlines(String(raw || ""));
	doc.body.innerHTML = rendered;
	return normalizeNewlines(doc.body.textContent || "")
		.replace(/\u00a0/g, " ")
		.trim();
};

export const answerHasContent = (raw: string): boolean => hasMeaningfulText(answerToPlainText(raw));
