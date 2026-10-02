interface AvatarProps {
  /** Fallback initial letter when no image. */
  initial?: string;
  /** Background color (hex or CSS var). */
  color?: string;
  /** Diameter in px — default 32. */
  size?: number;
  /** Optional extra className. */
  className?: string;
}

export default function Avatar({
  initial = "?",
  color = "var(--wine)",
  size = 32,
  className = "",
}: AvatarProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-[var(--cream)] ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.38,
      }}
    >
      {initial.toUpperCase()}
    </div>
  );
}
