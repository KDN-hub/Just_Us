import { User } from "lucide-react";

interface AvatarProps {
  /** Fallback initial letter when no image. */
  initial?: string;
  /** Background color (hex or CSS var). */
  color?: string;
  /** Diameter in px — default 32. */
  size?: number;
  /** Optional extra className. */
  className?: string;
  /** Optional image URL for profile picture. */
  imageUrl?: string | null;
}

export default function Avatar({
  initial = "?",
  color = "var(--wine)",
  size = 32,
  className = "",
  imageUrl,
}: AvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt="Avatar"
        className={`flex shrink-0 object-cover rounded-full ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
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
      {initial === "USER" ? <User size={size * 0.55} strokeWidth={2} /> : initial.toUpperCase()}
    </div>
  );
}
