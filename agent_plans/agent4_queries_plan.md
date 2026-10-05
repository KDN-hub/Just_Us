# Supabase Query Optimization Plan

## Current Implementation Issues
1. **Unbounded Data Fetching (O(N) data transfer):**
   In `app/chat/page.tsx`, the `resync()` function fetches all messages and call logs for the conversation unconditionally and without any limit:
   ```typescript
   supabase.from("messages").select("...").eq("conversation_id", ...).order("created_at", { ascending: true })
   ```
   As the chat history grows, this will cause massive payload sizes, slow initial loads, and memory bloat.

2. **Inefficient `resync` Triggers:**
   `resync()` runs on first load, on every reconnect, and every time the app comes back to the foreground (`visibilitychange`). Fetching the entire history repeatedly on foregrounding is highly inefficient and uses excess bandwidth.

## Proposed Optimizations

### 1. Implement Pagination for Initial Load
Instead of fetching all messages, we should only fetch the most recent N messages (e.g., 50) and reverse them client-side:
```typescript
const { data, error } = await supabase
  .from("messages")
  .select("id, sender_id, content, type, status, created_at")
  .eq("conversation_id", CONVERSATION_ID)
  .order("created_at", { ascending: false }) // Get newest first
  .limit(50);

// Then reverse client-side to maintain chronological order
const fetched = (data as Message[]).reverse();
```
*(Same logic applies to the `call_log` query.)*

### 2. Implement Infinite Scrolling (Load Older Messages)
Add a function `loadOlderMessages()` that is triggered when the user scrolls to the top of the chat view.
```typescript
const loadOlderMessages = async () => {
  const oldestMessage = messages[0];
  if (!oldestMessage) return;

  const { data } = await supabase
    .from("messages")
    .select("...")
    .eq("conversation_id", CONVERSATION_ID)
    .lt("created_at", oldestMessage.created_at) // Fetch messages older than the oldest we have
    .order("created_at", { ascending: false })
    .limit(50);
    
  if (data) {
    const olderMessages = data.reverse();
    setMessages(prev => [...olderMessages, ...prev]);
  }
}
```

### 3. Delta Sync on Reconnect / Foregrounding
To avoid re-fetching the initial 50 messages every time the user foregrounds the app, use the latest known message timestamp to fetch only missed messages (Delta sync).
```typescript
// Keep track of latest message timestamp in a ref (e.g. latestMessageRef)
const lastKnownTimestamp = latestMessageRef.current?.created_at;

let query = supabase
  .from("messages")
  .select("id, sender_id, content, type, status, created_at")
  .eq("conversation_id", CONVERSATION_ID);

if (lastKnownTimestamp) {
  // Delta sync: fetch only messages created after our last known message
  query = query.gt("created_at", lastKnownTimestamp).order("created_at", { ascending: true });
} else {
  // Initial load: fetch last 50
  query = query.order("created_at", { ascending: false }).limit(50);
}
```

### 4. Optimize `markPartnerMessagesRead`
Currently, this updates all unread messages from the partner:
```typescript
supabase
  .from("messages")
  .update({ status: "read" })
  .eq("sender_id", partnerId)
  .neq("status", "read")
```
While this works, it requires a table scan if not properly indexed.
**Recommendation:** Ensure a compound index exists on `(conversation_id, sender_id, status)` in the database, OR update only the specific `in()` array of unread message IDs currently loaded in the client state.
