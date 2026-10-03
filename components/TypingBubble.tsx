export default function TypingBubble() {
  return (
    <div className="flex flex-col items-start mt-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex h-[38px] w-[60px] items-center justify-center rounded-[16px_16px_16px_4px] bg-[var(--card)] px-3 shadow-sm">
        <div className="flex gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#8A8177] animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1s" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-[#8A8177] animate-bounce" style={{ animationDelay: "150ms", animationDuration: "1s" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-[#8A8177] animate-bounce" style={{ animationDelay: "300ms", animationDuration: "1s" }} />
        </div>
      </div>
    </div>
  );
}
