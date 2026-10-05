# UI/UX Refinement Plan

This plan details the proposed code changes to refine the layout, spacing, typography, and visual hierarchy across the "Just Us" application, while strictly adhering to the existing color scheme (`var(--wine)`, `var(--gold)`, `var(--cream)`, etc.).

## 1. Typography & Hierarchy
- **Consistent Serif Usage:** Extend the use of the elegant `Fraunces` serif font (`font-serif`) beyond the welcome screen. Apply it to major headings across the app: Settings screen headers, Onboarding bottom-sheet titles, and the partner's name in the Chat header. This establishes a premium, intimate aesthetic.
- **Improved Legibility:** 
  - Standardize body text size. Increase message bubble text from `text-[15px]` to `text-base` (16px) with `leading-relaxed` for better mobile readability.
  - Apply `tracking-tight` to large headings and `tracking-wider` to uppercase overlines (e.g., "ONBOARDING" kicker).
- **Contrast Adjustments:** The current `--muted` (`#8a8177`) against `--card` (`#26221e`) may have low contrast. Instead of modifying the palette, we will use `text-[var(--cream)]/60` for better accessibility on dark backgrounds, or selectively lighten the muted text to `#A0978E` where necessary.

## 2. Layout & Spacing
- **Standardized Screen Padding:** Unify horizontal padding across full-screen views (Onboarding, Settings, Call). Transition from a mix of `px-4`, `px-8`, and `px-[18px]` to a consistent `px-6` (`px-5` for slightly denser views) to create a predictable grid.
- **Message Bubble Grouping:** In `app/chat/page.tsx`, dynamically adjust spacing and border-radii for consecutive messages from the same sender. 
  - Reduce the vertical gap between grouped messages to `gap-1` (4px), keeping a larger `gap-4` (16px) between different senders.
  - Dynamically flatten the inner corners (`rounded-tr-sm` / `rounded-br-sm`) of grouped messages to visually connect them into a single block.
- **Chat Input Bar Restyling:** Upgrade the input area (`app/chat/page.tsx`) to feel more modern and iOS-like:
  - Increase vertical padding from `py-2` to `py-3` to enlarge touch targets.
  - Add a glassmorphism effect: `bg-[var(--surface)]/85 backdrop-blur-md`.
- **Onboarding Bottom Sheets:** Increase the prominence of bottom sheets by using a more generous top radius (`rounded-t-[32px]`) and expanding the inner padding (`pt-8 pb-10`).

## 3. Visual Aesthetics & Affordances
- **Standardized Border Radii (Corners):** Currently, buttons and inputs mix `10px`, `12px`, and `24px` radii. 
  - Use `rounded-2xl` (16px) universally for text inputs and large CTA buttons (like "Get started" or "Continue").
  - Keep fully rounded `rounded-full` for icon buttons (Send, Mic, Settings).
- **Depth & Shadows:** Add rich, colored drop-shadows to primary actions to lift them off the dark background. 
  - Example: Apply `shadow-[0_8px_16px_-6px_rgba(122,44,59,0.5)]` (derived from `--wine`) to the main CTA buttons and the Chat Send button.
- **Interactive Feedback:** Enhance micro-interactions by standardizing the active states. Apply `transition-all active:scale-[0.97] hover:brightness-110` to all buttons and clickable bubbles (e.g., media attachments).
- **Overlay Refinement (Emoji/Media Picker):** Wrap the absolute-positioned emoji picker menu in a blurred container (`backdrop-blur-xl bg-[var(--card)]/90 border border-white/5`) and add an `animate-in slide-in-from-bottom-2` animation to make its entrance smoother.

## 4. Component-Specific Tweaks
- **`PinPad.tsx`**: Ensure the number buttons are large enough for comfortable tapping (min `h-16 w-16`) and provide a subtle `bg-white/5` hover state.
- **`MessageBubble.tsx` (Media)**: For images and videos, ensure the timestamp/status pill overlays gracefully on light and dark media by using a slightly darker gradient scrim `bg-gradient-to-t from-black/60 to-transparent` at the bottom of the media.
- **Live Status Indicators**: Give the green "Online" dot in the chat header a gentle pulsing animation (`animate-pulse` or a custom ping) to make the connection feel more "live".
