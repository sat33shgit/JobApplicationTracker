import { useEffect, useMemo, useRef, useState } from "react";
import {
	answerHasContent,
	prepareAnswerForEditor,
	sanitizeAnswerHtml,
} from "../utils/interviewAnswerFormat";

const TOOLBAR_BUTTONS = [
	{ command: "bold", label: "B", title: "Bold", className: "font-semibold" },
	{ command: "italic", label: "I", title: "Italic", className: "italic" },
	{ command: "underline", label: "U", title: "Underline", className: "underline" },
	{ command: "insertUnorderedList", label: "Bullets", title: "Bulleted list" },
	{ command: "insertOrderedList", label: "Numbered", title: "Numbered list" },
];

const EMPTY_COMMAND_STATE = {
	bold: false,
	italic: false,
	underline: false,
	insertUnorderedList: false,
	insertOrderedList: false,
};

const hasMeaningfulText = (value) =>
	String(value || "")
		.replace(/\u00a0/g, " ")
		.trim().length > 0;

const getElementFromNode = (node) => {
	if (!node) return null;
	return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
};

const isEmptyParagraph = (node) => {
	if (!(node instanceof HTMLElement) || node.tagName !== "P") return false;
	return !hasMeaningfulText(node.textContent) && node.querySelector("br") !== null;
};

const findCurrentBlock = (editor, selection) => {
	if (!editor || !selection || selection.rangeCount === 0) return null;
	const anchorElement = getElementFromNode(selection.anchorNode);
	if (!anchorElement || !editor.contains(anchorElement)) return null;
	const block = anchorElement.closest("p, li, blockquote, ul, ol");
	return block && editor.contains(block) ? block : null;
};

const placeCaretInside = (element) => {
	if (!element) return;
	const selection = window.getSelection?.();
	if (!selection) return;
	const range = document.createRange();
	range.selectNodeContents(element);
	range.collapse(true);
	selection.removeAllRanges();
	selection.addRange(range);
};

export function RichTextEditor({
	value,
	onChange,
	placeholder,
	disabled = false,
	hasError = false,
	inputId,
}) {
	const editorRef = useRef(null);
	const lastEmittedValueRef = useRef(value);
	const [draftHtml, setDraftHtml] = useState(() => prepareAnswerForEditor(value || ""));
	const [commandState, setCommandState] = useState(EMPTY_COMMAND_STATE);

	useEffect(() => {
		if (value === lastEmittedValueRef.current) return;
		const nextValue = prepareAnswerForEditor(value || "");
		setDraftHtml(nextValue);
		lastEmittedValueRef.current = value;
	}, [value]);

	useEffect(() => {
		const editor = editorRef.current;
		if (!editor) return;
		if (editor.innerHTML !== draftHtml) {
			editor.innerHTML = draftHtml;
		}
	}, [draftHtml]);

	const isEmpty = useMemo(() => !answerHasContent(draftHtml), [draftHtml]);

	const refreshCommandState = () => {
		const editor = editorRef.current;
		const selection = typeof window !== "undefined" ? window.getSelection() : null;
		if (
			!editor ||
			!selection ||
			selection.rangeCount === 0 ||
			!editor.contains(selection.anchorNode)
		) {
			setCommandState(EMPTY_COMMAND_STATE);
			return;
		}

		try {
			setCommandState({
				bold: Boolean(document.queryCommandState?.("bold")),
				italic: Boolean(document.queryCommandState?.("italic")),
				underline: Boolean(document.queryCommandState?.("underline")),
				insertUnorderedList: Boolean(document.queryCommandState?.("insertUnorderedList")),
				insertOrderedList: Boolean(document.queryCommandState?.("insertOrderedList")),
			});
		} catch (_error) {
			setCommandState(EMPTY_COMMAND_STATE);
		}
	};

	const emitValue = (nextValue) => {
		lastEmittedValueRef.current = nextValue;
		setDraftHtml(nextValue);
		onChange(nextValue);
	};

	const syncEditor = ({ sanitize = false } = {}) => {
		const editor = editorRef.current;
		if (!editor) return;
		const nextValue = sanitize ? sanitizeAnswerHtml(editor.innerHTML) : editor.innerHTML;
		if (sanitize && editor.innerHTML !== nextValue) {
			editor.innerHTML = nextValue;
		}
		emitValue(nextValue);
		refreshCommandState();
	};

	const applyCommand = (command) => {
		if (disabled) return;
		const editor = editorRef.current;
		if (!editor) return;
		editor.focus();
		try {
			document.execCommand?.("styleWithCSS", false, false);
		} catch (_error) {
			// Ignore unsupported command in browsers that do not expose it.
		}
		document.execCommand?.(command, false, undefined);
		syncEditor();
	};

	const clearFormatting = () => {
		if (disabled) return;
		const editor = editorRef.current;
		if (!editor) return;
		editor.focus();
		document.execCommand?.("removeFormat", false, undefined);
		document.execCommand?.("unlink", false, undefined);
		syncEditor({ sanitize: true });
	};

	const insertBlankLine = () => {
		if (disabled) return;
		const editor = editorRef.current;
		if (!editor) return;
		editor.focus();

		const selection = window.getSelection?.();
		const currentBlock = findCurrentBlock(editor, selection);
		const referenceBlock =
			currentBlock instanceof HTMLElement && currentBlock.tagName === "LI"
				? currentBlock.closest("ul, ol") || currentBlock
				: currentBlock;

		const paragraph = document.createElement("p");
		paragraph.appendChild(document.createElement("br"));

		if (referenceBlock && referenceBlock !== editor) {
			referenceBlock.insertAdjacentElement("afterend", paragraph);
		} else {
			editor.appendChild(paragraph);
		}

		placeCaretInside(paragraph);
		syncEditor();
	};

	const removeBlankLine = () => {
		if (disabled) return;
		const editor = editorRef.current;
		if (!editor) return;
		editor.focus();

		const selection = window.getSelection?.();
		const currentBlock = findCurrentBlock(editor, selection);
		const candidates = [];

		if (currentBlock instanceof HTMLElement) {
			candidates.push(currentBlock);
			if (currentBlock.previousElementSibling) candidates.push(currentBlock.previousElementSibling);
			if (currentBlock.nextElementSibling) candidates.push(currentBlock.nextElementSibling);
		}

		const paragraphToRemove = candidates.find((candidate) => isEmptyParagraph(candidate));
		if (!paragraphToRemove) return;

		const fallbackTarget =
			paragraphToRemove.previousElementSibling || paragraphToRemove.nextElementSibling || editor;
		paragraphToRemove.remove();
		placeCaretInside(fallbackTarget);
		syncEditor({ sanitize: true });
	};

	return (
		<div className="overflow-hidden rounded-md border border-gray-300">
			<div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
				{TOOLBAR_BUTTONS.map((button) => (
					<button
						key={button.command}
						type="button"
						disabled={disabled}
						onMouseDown={(event) => event.preventDefault()}
						onClick={() => applyCommand(button.command)}
						title={button.title}
						className={`cursor-pointer rounded-md border px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
							commandState[button.command]
								? "border-blue-600 bg-blue-600 text-white"
								: "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
						} ${button.className || ""}`}
					>
						{button.label}
					</button>
				))}
				<button
					type="button"
					disabled={disabled}
					onMouseDown={(event) => event.preventDefault()}
					onClick={clearFormatting}
					className="cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Clear
				</button>
				<button
					type="button"
					disabled={disabled}
					onMouseDown={(event) => event.preventDefault()}
					onClick={insertBlankLine}
					title="Insert a blank line"
					className="cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Space +
				</button>
				<button
					type="button"
					disabled={disabled}
					onMouseDown={(event) => event.preventDefault()}
					onClick={removeBlankLine}
					title="Remove a nearby blank line"
					className="cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Space -
				</button>
			</div>

			<div
				ref={editorRef}
				id={inputId}
				contentEditable={!disabled}
				suppressContentEditableWarning
				role="textbox"
				tabIndex={disabled ? -1 : 0}
				aria-multiline="true"
				aria-label="Answer"
				data-placeholder={placeholder}
				data-empty={isEmpty ? "true" : "false"}
				className={`rich-text-editor interview-answer-content min-h-[10rem] px-3 py-2 text-gray-900 outline-none ${disabled ? "cursor-not-allowed bg-gray-100" : "bg-white"} ${hasError ? "ring-1 ring-red-500" : ""}`}
				onInput={() => syncEditor()}
				onBlur={() => syncEditor({ sanitize: true })}
				onKeyUp={refreshCommandState}
				onMouseUp={refreshCommandState}
			/>
		</div>
	);
}

export default RichTextEditor;
