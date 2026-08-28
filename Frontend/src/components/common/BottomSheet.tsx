// ── Bottom Sheet ──────────────────────────────────────────────────────────────

function BottomSheet({ onClose, children, title }: { onClose: () => void; children: React.ReactNode; title?: string }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end sheet-backdrop animate-fade-in" onClick={onClose}>
      <div
        className="rounded-t-[28px] flex flex-col max-h-[90%] animate-slide-up"
        style={{ background: "#FFFBFE" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-8 h-1 rounded-full" style={{ background: "#CAC4D0" }} />
        </div>
        {title && (
          <div className="px-6 pt-2 pb-4 shrink-0">
            <h2 className="text-xl font-semibold" style={{ fontFamily: "'Google Sans', sans-serif", color: "#1C1B1F" }}>{title}</h2>
          </div>
        )}
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

export { BottomSheet };
