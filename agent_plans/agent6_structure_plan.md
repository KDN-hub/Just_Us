# Architecture Review & Refactoring Plan

## 1. Missing Error Boundaries
- **Issue**: The application relies heavily on asynchronous data fetching and third-party APIs (Supabase). A failure in any of these will crash the entire route without a fallback UI.
- **Action**: 
  - Add `app/error.tsx` to handle general application errors.
  - Add `app/global-error.tsx` to catch errors at the root layout level.
  - Add route-specific error boundaries (e.g., `app/chat/error.tsx`, `app/call/error.tsx`) to isolate failures so that if a call fails, the chat remains accessible, and vice versa.

## 2. Unhandled Promises
- **Issue**: Several asynchronous operations using `.then()` lack a corresponding `.catch()`, which can lead to unhandled promise rejections and silent failures, especially during network interruptions.
- **Action**:
  - In `app/page.tsx`: The `supabase.auth.getSession().then(...)` chain lacks error handling. Add a `.catch(console.error)` or convert to `async/await` within a `try/catch` block.
  - In `app/chat/page.tsx` (around line 558): `supabase.from("conversation").select(...).single().then(...)` needs a `.catch()` block to handle database or network errors gracefully.
  - In `lib/auth.ts`: `loadProfile` suppresses the error in `.getSession()` by not catching potential exceptions thrown by the underlying fetch implementation if the network drops entirely.

## 3. Messy / Monolithic Components
- **Issue**: `app/chat/page.tsx` is massively overgrown (1300+ lines). It handles UI rendering, WebRTC signaling, Supabase Realtime subscriptions, media recording, and file uploading all in one file.
- **Action**: Refactor `app/chat/page.tsx` into smaller, focused modules:
  - **Custom Hooks**: Extract state and side effects into `hooks/useChatRealtime.ts` and `hooks/useMediaRecorder.ts`.
  - **Sub-components**: Split the UI into `ChatHeader.tsx` (contact info, call buttons), `MessageList.tsx` (scrollable message area), and `ChatInput.tsx` (text area, emoji picker, attachments).
- **Issue**: `app/call/page.tsx` (670+ lines) mixes complex WebRTC state machine logic with the rendering of the call screen.
- **Action**: Extract the WebRTC connection logic into a `hooks/useWebRTC.ts` hook.

## 4. Next Steps for Execution
- DO NOT modify the main application code yet. This plan serves as a blueprint for the team.
- Assign the splitting of `app/chat/page.tsx` to the component specialist.
- Assign the error boundaries and unhandled promises to the reliability engineer.
