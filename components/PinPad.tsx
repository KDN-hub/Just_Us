"use client";

import { useState, useEffect, useCallback } from "react";
import { Delete, Fingerprint } from "lucide-react";
import { motion } from "framer-motion";

interface PinPadProps {
  /** Called with the full PIN string once all 4 digits are entered. */
  onComplete?: (pin: string) => void;
  /** Called whenever digits change. */
  onChange?: (pin: string) => void;
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
  /** Whether to automatically call onComplete when full length is reached (default true) */
  autoComplete?: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

export default function PinPad({
  onComplete,
  onChange,
  error = false,
  label = "Enter PIN",
  length = 4,
  showBiometric = false,
  onBiometric,
  autoComplete = true,
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
        onChange?.("");
      }, 600);
      return () => clearTimeout(t);
    }
  }, [error, onChange]);

  const handleKey = useCallback(
    (key: string) => {
      if (key === "del") {
        const next = digits.slice(0, -1);
        setDigits(next);
        onChange?.(next.join(""));
        return;
      }
      if (digits.length >= length) return;
      const next = [...digits, key];
      setDigits(next);
      onChange?.(next.join(""));
      if (next.length === length && autoComplete && onComplete) {
        // Small delay so the last dot visually fills before callback fires
        setTimeout(() => onComplete(next.join("")), 80);
      }
    },
    [digits, length, onComplete, onChange, autoComplete],
  );

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Label */}
      <p className="text-[18px] font-semibold tracking-wide text-white/90">{label}</p>

      {/* Dot indicators */}
      <motion.div
        animate={shake ? { x: [-10, 10, -8, 8, -5, 5, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex gap-6 transition-all mt-2"
      >
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={`h-[20px] w-[20px] rounded-full border-[2.5px] transition-all duration-200 ${
              i < digits.length
                ? "border-[var(--wine)] bg-[var(--wine)] scale-110 shadow-[0_0_8px_rgba(188,21,41,0.6)]"
                : "border-[var(--border)] bg-transparent"
            }`}
          />
        ))}
      </motion.div>

      {/* Keypad grid */}
      <div className="grid w-fit grid-cols-[repeat(3,64px)] gap-4 mt-2">
        {KEYS.map((key, i) => {
          if (key === "") {
            if (showBiometric && onBiometric) {
              return (
                <motion.button
                  whileTap={{ scale: 0.9, backgroundColor: "rgba(122,44,59,0.3)" }}
                  key="biometric-btn"
                  type="button"
                  onClick={onBiometric}
                  className="flex h-[64px] w-[64px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--gold)] transition-all hover:bg-white/5"
                  aria-label="Unlock with Face ID or fingerprint"
                  title="Unlock with biometrics"
                >
                  <Fingerprint className="h-6 w-6 text-[var(--gold)]" strokeWidth={1.8} />
                </motion.button>
              );
            }
            return <div key={`empty-${i}`} className="h-[64px]" />;
          }

          return (
            <motion.button
              whileTap={{ scale: 0.9, backgroundColor: "rgba(122,44,59,0.3)" }}
              key={key}
              type="button"
              onClick={() => handleKey(key)}
              className="flex h-[64px] w-[64px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[22px] font-medium text-[var(--cream)] transition-all hover:bg-white/5 shadow-sm"
              aria-label={key === "del" ? "Delete" : key}
            >
              {key === "del" ? (
                <Delete className="h-[22px] w-[22px] text-[var(--cream)]" strokeWidth={2} />
              ) : (
                key
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
