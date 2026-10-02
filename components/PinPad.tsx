"use client";

import { useState, useEffect, useCallback } from "react";
import { Delete, Fingerprint } from "lucide-react";

interface PinPadProps {
  /** Called with the full PIN string once all 4 digits are entered. */
  onComplete: (pin: string) => void;
  /** If true the dots shake and clear (signals a wrong PIN from parent). */
  error?: boolean;
  /** Label shown above the dots, e.g. "Enter PIN" or "Confirm your PIN". */
  label?: string;
  /** Number of digits — default 4. */
  length?: number;
  /** Whether to show the biometric button in the bottom-left slot */
  showBiometric?: boolean;
  /** Triggered when the biometric button is tapped */
  onBiometric?: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

export default function PinPad({
  onComplete,
  error = false,
  label = "Enter PIN",
  length = 4,
  showBiometric = false,
  onBiometric,
}: PinPadProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const [shake, setShake] = useState(false);

  // Trigger shake + clear when parent signals an error
  useEffect(() => {
    if (error) {
      setShake(true);
      const t = setTimeout(() => {
        setShake(false);
        setDigits([]);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handleKey = useCallback(
    (key: string) => {
      if (key === "del") {
        setDigits((prev) => prev.slice(0, -1));
        return;
      }
      if (digits.length >= length) return;
      const next = [...digits, key];
      setDigits(next);
      if (next.length === length) {
        // Small delay so the last dot visually fills before callback fires
        setTimeout(() => onComplete(next.join("")), 80);
      }
    },
    [digits, length, onComplete],
  );

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Label */}
      <p className="text-[14px] text-[#8A8177]">{label}</p>

      {/* Dot indicators */}
      <div
        className={`flex gap-4 transition-all ${shake ? "animate-shake" : ""}`}
      >
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={`h-[14px] w-[14px] rounded-full border-2 transition-colors duration-150 ${
              i < digits.length
                ? "border-[#7A2C3B] bg-[#7A2C3B]"
                : "border-[#3A342E] bg-transparent"
            }`}
          />
        ))}
      </div>

      {/* Keypad grid */}
      <div className="grid w-fit grid-cols-[repeat(3,68px)] gap-4">
        {KEYS.map((key, i) => {
          if (key === "") {
            if (showBiometric && onBiometric) {
              return (
                <button
                  key="biometric-btn"
                  type="button"
                  onClick={onBiometric}
                  className="flex h-16 w-16 items-center justify-center rounded-full border border-[#3A342E] bg-[#1E1B18] text-[#C9A66B] transition-colors hover:border-[#C9A66B]/50 active:bg-[#7A2C3B]/30"
                  aria-label="Unlock with Face ID or fingerprint"
                  title="Unlock with biometrics"
                >
                  <Fingerprint className="h-6 w-6 text-[#C9A66B]" strokeWidth={1.8} />
                </button>
              );
            }
            return <div key={`empty-${i}`} className="h-16" />;
          }

          return (
            <button
              key={key}
              type="button"
              onClick={() => handleKey(key)}
              className="flex h-16 w-16 items-center justify-center rounded-full border border-[#3A342E] bg-[#1E1B18] text-[22px] font-medium text-[#F5F0E8] transition-colors active:bg-[#7A2C3B]/30"
              aria-label={key === "del" ? "Delete" : key}
            >
              {key === "del" ? (
                <Delete className="h-5 w-5 text-[#F5F0E8]" strokeWidth={2} />
              ) : (
                key
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
