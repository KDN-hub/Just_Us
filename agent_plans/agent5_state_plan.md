# State Management & Real-time Messaging Plan

## Current Implementation Analysis
- **State Handling**: React's `useState` is used for storing `messages` and `callLog`. The state is initialized from a local cache `localStorage.getItem(MSG_CACHE_KEY)`.
- **Data Fetching**: The `resync()` function currently fetches **all** messages for the conversation without any limits or pagination. This is a severe bottleneck that will slow down the app as the chat history grows.
- **Subscriptions**: A single Supabase channel (`db-sync-<CONVERSATION_ID>`) listens to `INSERT` and `UPDATE` on `messages`, `users`, and `call_log`. 
- **Message Updates**: On receiving an event, the code scans the entire `messages` array (`prev.some(...)`, `prev.map(...)`) which is `O(N)` and gets slower as the chat size increases.

## Proposed Improvements

### 1. Paginated & Cursor-Based Data Fetching
- **Issue**: `resync()` downloads the entire message history on every reconnect.
- **Solution**: Implement infinite scrolling. On initial load, fetch only the latest 50-100 messages. Provide a mechanism to fetch older messages when the user scrolls to the top. During reconnects, `resync()` should only fetch messages where `created_at` > the latest message in the state (cursor-based sync), avoiding full data re-fetching.

### 2. Transition to Global/Normalized State Management
- **Issue**: Keeping an expanding array of messages in `useState` and iterating through it with array methods (`.some`, `.map`) is inefficient.
- **Solution**: 
  - Migrate message state to a global store like **Zustand** or use data-fetching libraries like **React Query**.
  - **Normalize State**: Store messages as an object dictionary/map keyed by `message.id` (`Record<string, Message>`). This turns lookup, insert, and update times from `O(N)` to `O(1)`. 
  - Maintain a separate sorted array of message IDs to determine rendering order.

### 3. Decoupling Real-time Logic from UI Component
- **Issue**: The `Chat` component is massively bloated (over 1300 lines) with WebSocket management, caching, offline queuing, and data fetching mixed into the UI logic.
- **Solution**: Extract the real-time Supabase subscription and message caching logic into a dedicated custom hook (e.g., `useChatMessages`) or a Zustand store. This separates concerns, making the UI component cleaner and strictly focused on rendering.

### 4. Batching Real-Time Updates
- **Issue**: Bulk updates (like marking 10 messages as read) will trigger multiple individual `UPDATE` events from Supabase, leading to multiple React re-renders.
- **Solution**: Batch incoming Supabase real-time events. Accumulate incoming messages/updates in a small time window (e.g., 50ms) and apply them to the state in a single operation.

### 5. Improved Offline Support
- **Issue**: Offline queuing is manually handled inside the UI component with side effects watching `isOnline`.
- **Solution**: Delegate offline mutations to an optimistic UI mutation queue (such as React Query's offline mutations or a dedicated background sync API) that reliably persists unsent actions until the network is restored.
