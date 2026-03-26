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
const FONT_SIZE_OPTIONS = [
	{ label: "Small", value: "2" },
	{ label: "Normal", value: "3" },
	{ label: "Large", value: "4" },
	{ label: "XL", value: "5" },
];

const EMPTY_COMMAND_STATE = {
	bold: false,
	italic: false,
	underline: false,
	insertUnorderedList: false,
	insertOrderedList: false,
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

	const applyFontSize = (value) => {
		if (disabled || !value) return;
		const editor = editorRef.current;
		if (!editor) return;
		editor.focus();
		try {
			document.execCommand?.("styleWithCSS", false, false);
		} catch (_error) {
			// Ignore unsupported command in browsers that do not expose it.
		}
		document.execCommand?.("fontSize", false, value);
		syncEditor({ sanitize: true });
	};

	return (
		<div className="relative rounded-md border border-gray-300 bg-white">
			<div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-t-md border-b border-gray-200 bg-gray-50 px-3 py-2 shadow-[0_1px_0_rgba(229,231,235,1)]">
				<select
					disabled={disabled}
					defaultValue=""
					aria-label="Font size"
					onMouseDown={(event) => event.stopPropagation()}
					onChange={(event) => {
						applyFontSize(event.target.value);
						event.target.value = "";
					}}
					className="cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<option value="">Font size</option>
					{FONT_SIZE_OPTIONS.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
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
				className={`rich-text-editor interview-answer-content min-h-[10rem] rounded-b-md px-3 py-2 text-gray-900 outline-none ${disabled ? "cursor-not-allowed bg-gray-100" : "bg-white"} ${hasError ? "ring-1 ring-red-500" : ""}`}
				onInput={() => syncEditor()}
				onBlur={() => syncEditor({ sanitize: true })}
				onKeyUp={refreshCommandState}
				onMouseUp={refreshCommandState}
			/>
		</div>
	);
}

export default RichTextEditor;
