import type React from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type SimpleModalProps = {
	open: boolean;
	onClose: () => void;
	children: React.ReactNode;
	titleId?: string;
	descriptionId?: string;
	blur?: boolean;
};

export default function SimpleModal({
	open,
	onClose,
	children,
	titleId,
	descriptionId,
	blur,
}: SimpleModalProps) {
	const containerRef = useRef<HTMLDialogElement | null>(null);

	useEffect(() => {
		if (!open) return;
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handleKey);
		// focus the container for accessibility
		setTimeout(() => containerRef.current?.focus(), 0);
		return () => document.removeEventListener("keydown", handleKey);
	}, [open, onClose]);

	if (!open) return null;
	return createPortal(
		<div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
			<button
				type="button"
				aria-label="Close modal"
				className={
					blur
						? "absolute inset-0 bg-white/40 backdrop-blur-lg"
						: "absolute inset-0 bg-black bg-opacity-40"
				}
				style={
					blur ? { backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" } : undefined
				}
				onClick={onClose}
			/>
			<div className="relative w-full max-w-2xl mx-auto pointer-events-auto">
				<dialog
					ref={containerRef}
					open
					aria-modal="true"
					aria-labelledby={titleId}
					aria-describedby={descriptionId}
					tabIndex={-1}
					onCancel={(event) => {
						event.preventDefault();
						onClose();
					}}
					className="bg-white rounded-lg shadow-xl w-full p-6 max-h-[80vh] overflow-visible m-0"
				>
					{children}
				</dialog>
			</div>
		</div>,
		typeof document !== "undefined" ? document.body : null,
	);
}
