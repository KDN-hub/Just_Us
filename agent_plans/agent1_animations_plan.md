# UI Animations Plan

This plan outlines the proposed animations and tap reactions for the Just_Us app to improve interactivity and user experience, utilizing **Framer Motion** for spring physics and layout transitions, and **Tailwind CSS** for simple hover/active states.

## 1. Setup
Install `framer-motion`:
```bash
npm install framer-motion
```

## 2. Components to Animate

### A. MessageBubble.tsx (`components/MessageBubble.tsx`)
- **Slide-in Animation**: Wrap the outermost bubble div in a `motion.div`. New messages will slide up smoothly.
  ```jsx
  <motion.div
    initial={{ y: 20, opacity: 0, scale: 0.95 }}
    animate={{ y: 0, opacity: 1, scale: 1 }}
    transition={{ type: "spring", stiffness: 300, damping: 25 }}
    className="..."
  >
  ```
- **Reaction Menu Pop-up**: When the reaction menu appears (`showReactionMenu`), animate its entrance.
  ```jsx
  <motion.div
    initial={{ opacity: 0, scale: 0.8, y: 10 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.8 }}
    className="absolute -top-12..."
  >
  ```
- **Tap Reaction on Emojis**: 
  ```jsx
  <motion.button whileTap={{ scale: 1.3 }} ...>
  ```
- **Nudge Animation**: Make the "NUDGE_PING_💖" scale up dynamically with a heartbeat physics spring.

### B. PinPad.tsx (`components/PinPad.tsx`)
- **Button Tap Reactions**: Wrap the numbers and `del` key in `motion.button` to give immediate haptic-like visual feedback.
  ```jsx
  <motion.button
    whileTap={{ scale: 0.9, backgroundColor: "rgba(122,44,59,0.3)" }}
    className="..."
  >
  ```
- **Error Shake**: Maintain the existing Tailwind `animate-shake` or convert to Framer Motion for more control:
  ```jsx
  <motion.div animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}>
  ```

### C. Chat/Call Page Mounts (`app/chat/page.tsx`, `app/call/page.tsx`)
- **Page Transitions**: Wrap the page contents in `motion.div` with an `initial={{ opacity: 0 }}` and `animate={{ opacity: 1 }}` to ensure smooth routing transitions.

### D. Avatar.tsx (`components/Avatar.tsx`)
- **Tap effect**: Add `active:scale-95 transition-transform` or `whileTap={{ scale: 0.95 }}` so clicking the avatar provides visual feedback.

## 3. Action Items
1. Run `npm install framer-motion`.
2. Update `MessageBubble.tsx` to import `motion` from `framer-motion` and replace specific `div` and `button` tags with `motion.div`/`motion.button`.
3. Update `PinPad.tsx` to use `motion.button` for all keypad entries.
4. Add AnimatePresence for any conditionally rendered elements like reaction menus or overlays.
