import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

const CONVERSATION_ID = "c0000000-0000-0000-0000-000000000003";

export type MessageStatus = "sent" | "delivered" | "read";

export interface Message {
  id: string;
  sender_id: string;
  content: string;
  type: string;
  status: MessageStatus;
  created_at: string;
  pending?: boolean;
  queued?: boolean;
  reactions?: Record<string, string>; // sender_id -> emoji
  reply_to?: string;
  reply_to_text?: string;
  is_pinned?: boolean;
  is_edited?: boolean;
}

export interface CallLogEntry {
  id: string;
  caller_id: string;
  type: "voice" | "video";
  status: "missed" | "answered" | "declined" | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
}

export type TimelineItem =
  | { kind: "message"; data: Message; time: string }
  | { kind: "call"; data: CallLogEntry; time: string };

export interface UserRow {
  id: string;
  name: string;
  nickname: string | null;
  avatar_color: string | null;
  is_online: boolean;
  last_seen: string | null;
}

export interface IncomingCall {
  sdp: RTCSessionDescriptionInit;
  callType: "voice" | "video";
  callerId: string;
}

const STATUS_RANK: Record<MessageStatus, number> = { sent: 0, delivered: 1, read: 2 };

export function higherStatus(a: MessageStatus, b: MessageStatus): MessageStatus {
  return STATUS_RANK[b] > STATUS_RANK[a] ? b : a;
}

const MSG_CACHE_KEY = `msg_cache_c0000000-0000-0000-0000-000000000003`;
const MSG_CACHE_LIMIT = 100;

function loadMsgCache(): Record<string, Message> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(MSG_CACHE_KEY) : null;
    if (raw) {
      const arr = JSON.parse(raw) as Message[];
      const map: Record<string, Message> = {};
      for (const m of arr) map[m.id] = m;
      return map;
    }
  } catch {}
  return {};
}

function saveMsgCache(messages: Record<string, Message>) {
  try {
    const arr = Object.values(messages).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const toSave = arr.filter(m => !m.pending && !m.queued).slice(-MSG_CACHE_LIMIT);
    localStorage.setItem(MSG_CACHE_KEY, JSON.stringify(toSave));
  } catch {}
}

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

export function formatLastSeen(iso: string | null, now: number): string {
  if (!iso) return "Offline";
  const diff = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (diff < 60) return "Last seen just now";
  if (diff < 3600) return `Last seen ${plural(Math.floor(diff / 60), "minute")} ago`;
  if (diff < 86400) return `Last seen ${plural(Math.floor(diff / 3600), "hour")} ago`;
  return `Last seen ${plural(Math.floor(diff / 86400), "day")} ago`;
}

interface ChatState {
  myId: string;
  partner: UserRow | null;
  messages: Record<string, Message>;
  callLog: Record<string, CallLogEntry>;
  reconnecting: boolean;
  partnerTyping: boolean;
  isOnline: boolean;
  daysTogether: number;
  incomingCall: IncomingCall | null;
  hasMoreMessages: boolean;
  isLoadingOlder: boolean;
  
  setMyId: (id: string) => void;
  setPartner: (partner: Partial<UserRow>) => void;
  setReconnecting: (reconnecting: boolean) => void;
  setPartnerTyping: (typing: boolean) => void;
  setIsOnline: (online: boolean) => void;
  setDaysTogether: (days: number) => void;
  setIncomingCall: (call: IncomingCall | null) => void;
  loadOlderMessages: () => Promise<void>;
  
  addOrUpdateMessage: (msg: Message) => void;
  addOrUpdateMessages: (msgs: Message[]) => void;
  addOrUpdateCallLog: (call: CallLogEntry) => void;
  addOrUpdateCallLogs: (calls: CallLogEntry[]) => void;
  
  getMessageList: () => Message[];
  getCallLogList: () => CallLogEntry[];
}

export const useChatStore = create<ChatState>((set, get) => ({
  myId: typeof window !== 'undefined' ? localStorage.getItem("user_id") ?? "" : "",
  partner: (() => {
    if (typeof window === "undefined") return null;
    const id = localStorage.getItem("partner_id");
    const name = localStorage.getItem("partner_name");
    const color = localStorage.getItem("partner_color");
    if (!id || !name) return null;
    return { id, name, nickname: name, avatar_color: color, is_online: false, last_seen: null };
  })(),
  messages: loadMsgCache(),
  callLog: {},
  reconnecting: false,
  partnerTyping: false,
  isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
  daysTogether: 0,
  incomingCall: null,
  hasMoreMessages: true,
  isLoadingOlder: false,
  
  setMyId: (id) => set({ myId: id }),
  setPartner: (partnerInfo) => set((state) => ({
    partner: state.partner ? { ...state.partner, ...partnerInfo } : partnerInfo as UserRow
  })),
  setReconnecting: (reconnecting) => set({ reconnecting }),
  setPartnerTyping: (typing) => set({ partnerTyping: typing }),
  setIsOnline: (online) => set({ isOnline: online }),
  setDaysTogether: (days) => set({ daysTogether: days }),
  setIncomingCall: (call) => set({ incomingCall: call }),
  
  loadOlderMessages: async () => {
    const { messages, isLoadingOlder, hasMoreMessages } = get();
    if (isLoadingOlder || !hasMoreMessages) return;
    
    set({ isLoadingOlder: true });
    
    const msgList = Object.values(messages).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const oldestMessage = msgList[0];
    
    if (!oldestMessage) {
      set({ isLoadingOlder: false, hasMoreMessages: false });
      return;
    }
    
    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, content, type, status, created_at")
      .eq("conversation_id", CONVERSATION_ID)
      .lt("created_at", oldestMessage.created_at)
      .order("created_at", { ascending: false })
      .limit(50);
      
    if (error) {
      console.error("[chat] Failed to load older messages:", error.message);
      set({ isLoadingOlder: false });
      return;
    }
    
    if (data && data.length > 0) {
      get().addOrUpdateMessages(data as Message[]);
      set({ isLoadingOlder: false, hasMoreMessages: data.length === 50 });
    } else {
      set({ isLoadingOlder: false, hasMoreMessages: false });
    }
  },
  
  addOrUpdateMessage: (msg) => set((state) => {
    const existing = state.messages[msg.id];
    const newMessages = {
      ...state.messages,
      [msg.id]: existing 
        ? { ...existing, ...msg, status: higherStatus(existing.status, msg.status) }
        : msg
    };
    saveMsgCache(newMessages);
    return { messages: newMessages };
  }),
  
  addOrUpdateMessages: (msgs) => set((state) => {
    const newMessages = { ...state.messages };
    for (const msg of msgs) {
      const existing = newMessages[msg.id];
      newMessages[msg.id] = existing
        ? { ...existing, ...msg, status: higherStatus(existing.status, msg.status) }
        : msg;
    }
    saveMsgCache(newMessages);
    return { messages: newMessages };
  }),
  
  addOrUpdateCallLog: (call) => set((state) => ({
    callLog: { ...state.callLog, [call.id]: call }
  })),
  
  addOrUpdateCallLogs: (calls) => set((state) => {
    const newCallLog = { ...state.callLog };
    for (const call of calls) newCallLog[call.id] = call;
    return { callLog: newCallLog };
  }),
  
  getMessageList: () => Object.values(get().messages).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
  getCallLogList: () => Object.values(get().callLog).sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()),
}));
