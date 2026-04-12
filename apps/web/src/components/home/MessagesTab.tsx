import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Search, Send, Plus, X, MessageSquare } from "lucide-react";
import useGlobalPresence from "@/hooks/useGlobalPresence";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  other_user: Profile;
  last_message: string | null;
  last_message_at: string | null;
  unread: boolean;
}

// ─── Avatar Helper ────────────────────────────────────────────────────────────

const Avatar = ({
  user,
  size = 9,
  online = false,
}: {
  user: Profile | null;
  size?: number;
  online?: boolean;
}) => {
  const initials = user?.username?.[0]?.toUpperCase() ?? "?";
  return (
    <div className={`relative w-${size} h-${size} shrink-0`}>
      {user?.avatar_url ? (
        <img
          src={user.avatar_url}
          className={`w-${size} h-${size} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`w-${size} h-${size} rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-semibold text-xs`}
        >
          {initials}
        </div>
      )}
      <AnimatePresence>
        {online && (
          <motion.span
            key="online-dot"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.25, 1], opacity: [0.6, 1] }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-background shadow-[0_0_8px_rgba(34,197,94,0.9)]"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── New Conversation Modal ───────────────────────────────────────────────────

const NewConversationModal = ({
  currentUserId,
  onClose,
  onOpen,
}: {
  currentUserId: string;
  onClose: () => void;
  onOpen: (conv: Conversation) => void;
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .ilike("username", `%${query}%`)
        .neq("id", currentUserId)
        .limit(8);
      setResults(data ?? []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const startConversation = async (other: Profile) => {
    // Check if conversation already exists
    const { data: existing } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", currentUserId);

    const myConvIds = existing?.map((r) => r.conversation_id) ?? [];

    if (myConvIds.length > 0) {
      const { data: shared } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", other.id)
        .in("conversation_id", myConvIds);

      if (shared && shared.length > 0) {
        const convId = shared[0].conversation_id;
        onOpen({
          id: convId,
          other_user: other,
          last_message: null,
          last_message_at: null,
          unread: false,
        });
        onClose();
        return;
      }
    }

    // Create new conversation
    const { data: conv } = await supabase
      .from("conversations")
      .insert({})
      .select()
      .single();

    if (!conv) return;

    await supabase.from("conversation_participants").insert([
      { conversation_id: conv.id, user_id: currentUserId },
      { conversation_id: conv.id, user_id: other.id },
    ]);

    onOpen({
      id: conv.id,
      other_user: other,
      last_message: null,
      last_message_at: null,
      unread: false,
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="bg-card border border-border rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="font-semibold text-sm">New Message</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2 border border-border/50">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username..."
              className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="px-2 pb-3 max-h-72 overflow-y-auto">
          {loading && (
            <div className="text-center py-6 text-muted-foreground text-xs">Searching...</div>
          )}
          {!loading && results.length === 0 && query && (
            <div className="text-center py-6 text-muted-foreground text-xs">No users found</div>
          )}
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => startConversation(user)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors text-left"
            >
              <Avatar user={user} size={8} />
              <span className="text-sm font-medium">@{user.username}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Chat Window ──────────────────────────────────────────────────────────────

const ChatWindow = ({
  conversation,
  currentUserId,
  currentUser,
}: {
  conversation: Conversation;
  currentUserId: string;
  currentUser: Profile | null;
}) => {
  const { onlineUserIds } = useGlobalPresence();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load messages
  useEffect(() => {
    setLoading(true);
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });
      setMessages(data ?? []);
      setLoading(false);
      setTimeout(scrollToBottom, 50);
    };
    load();

    // Mark as read
    supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversation.id)
      .eq("user_id", currentUserId);

    // Realtime subscription
    const channel = supabase
      .channel(`messages:${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          setTimeout(scrollToBottom, 50);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversation.id]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");

    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: currentUserId,
      content: text,
    });
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-background/60 backdrop-blur-xl shrink-0">
        <Avatar user={conversation.other_user} size={8} online={onlineUserIds.has(conversation.other_user.id)} />
        <div>
          <p className="text-sm font-semibold">@{conversation.other_user.username}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-muted">
        {loading && (
          <div className="flex flex-col gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "" : "justify-end"}`}>
                <div className="h-8 w-48 rounded-2xl bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-20">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <MessageSquare size={20} className="text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Start a conversation with <span className="text-foreground font-medium">@{conversation.other_user.username}</span>
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}
              >
                {!isMe && <Avatar user={conversation.other_user} size={6} />}
                <div className={`max-w-[70%] group`}>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted/60 border border-border/50 text-foreground rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <p className={`text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? "text-right" : "text-left"}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
                {isMe && <Avatar user={currentUser} size={6} />}
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-background/60 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-2 bg-muted/40 rounded-2xl px-4 py-2.5 border border-border/50 focus-within:border-primary/40 transition-colors">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Message @${conversation.other_user.username}...`}
            className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={send}
            disabled={!input.trim()}
            className="text-primary disabled:text-muted-foreground transition-colors shrink-0"
          >
            <Send size={16} />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

// ─── Main MessagesTab ─────────────────────────────────────────────────────────

export default function MessagesTab() {
  const { onlineUserIds } = useGlobalPresence();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Load current user
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", user.id)
        .single();
      if (data) setCurrentUser(data);
    };
    load();
  }, []);

  // Load conversations
  const loadConversations = async () => {
    if (!currentUserId) return;
    setLoadingConvs(true);

    // Get all conversation IDs the user is in
    const { data: myParts } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", currentUserId);

    if (!myParts || myParts.length === 0) {
      setConversations([]);
      setLoadingConvs(false);
      return;
    }

    const convIds = myParts.map((p) => p.conversation_id);
    const lastReadMap: Record<string, string> = {};
    myParts.forEach((p) => { lastReadMap[p.conversation_id] = p.last_read_at; });

    // Get other participants
    const { data: otherParts } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", convIds)
      .neq("user_id", currentUserId);

    const otherUserIds = [...new Set(otherParts?.map((p) => p.user_id) ?? [])];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", otherUserIds);

    const profileMap: Record<string, Profile> = {};
    profiles?.forEach((p) => { profileMap[p.id] = p; });

    // Get last message per conversation
    const convList: Conversation[] = await Promise.all(
      convIds.map(async (convId) => {
        const otherUserId = otherParts?.find((p) => p.conversation_id === convId)?.user_id;
        const other = otherUserId ? profileMap[otherUserId] : null;

        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content, created_at, sender_id")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const unread = lastMsg
          ? lastMsg.sender_id !== currentUserId &&
            new Date(lastMsg.created_at) > new Date(lastReadMap[convId] ?? 0)
          : false;

        return {
          id: convId,
          other_user: other ?? { id: "", username: "Unknown", avatar_url: null },
          last_message: lastMsg?.content ?? null,
          last_message_at: lastMsg?.created_at ?? null,
          unread,
        };
      })
    );

    // Sort by last message time
    convList.sort((a, b) =>
      new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()
    );

    setConversations(convList);
    setLoadingConvs(false);
  };

  useEffect(() => {
    if (currentUserId) loadConversations();
  }, [currentUserId]);

  // Realtime: refresh convs on new message
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel("messages-global")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  const filteredConvs = conversations.filter((c) =>
    c.other_user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPreviewTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  if (!currentUserId) return null;

  return (
    <>
      <div className="flex flex-1 overflow-hidden h-full">
        {/* LEFT — Conversations sidebar */}
        <aside className="w-80 min-w-[280px] border-r border-border flex flex-col bg-muted/10">
          {/* Header */}
          <div className="px-4 py-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Messages</h2>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowNewModal(true)}
                className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
              >
                <Plus size={14} />
              </motion.button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2 border border-border/50">
              <Search size={12} className="text-muted-foreground shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="bg-transparent text-xs outline-none flex-1 placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted">
            {loadingConvs && (
              <div className="p-3 space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-2 py-2 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-muted rounded w-24" />
                      <div className="h-2.5 bg-muted rounded w-36" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loadingConvs && filteredConvs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center">
                  <MessageSquare size={18} className="text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {searchQuery ? "No conversations match" : "No messages yet. Start a conversation!"}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setShowNewModal(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    New message
                  </button>
                )}
              </div>
            )}

            {filteredConvs.map((conv) => (
              <motion.button
                key={conv.id}
                whileHover={{ backgroundColor: "hsl(var(--muted)/0.4)" }}
                onClick={() => setActiveConv(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                  activeConv?.id === conv.id ? "bg-muted/40 border-r-2 border-primary" : ""
                }`}
              >
                <div className="relative">
                  <Avatar user={conv.other_user} size={9} online={onlineUserIds.has(conv.other_user.id)} />
                  {conv.unread && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm truncate ${conv.unread ? "font-semibold" : "font-medium"}`}>
                      @{conv.other_user.username}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      {formatPreviewTime(conv.last_message_at)}
                    </span>
                  </div>
                  <p className={`text-xs truncate mt-0.5 ${conv.unread ? "text-foreground" : "text-muted-foreground"}`}>
                    {conv.last_message ?? "Start a conversation"}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        </aside>

        {/* RIGHT — Chat or empty state */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeConv ? (
            <ChatWindow
              key={activeConv.id}
              conversation={activeConv}
              currentUserId={currentUserId}
              currentUser={currentUser}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <MessageSquare size={28} className="text-primary" />
              </div>
              <div>
                <p className="font-semibold">Your Messages</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Select a conversation or start a new one
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowNewModal(true)}
                className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
              >
                New Message
              </motion.button>
            </div>
          )}
        </main>
      </div>

      {/* New Conversation Modal */}
      <AnimatePresence>
        {showNewModal && (
          <NewConversationModal
            currentUserId={currentUserId}
            onClose={() => setShowNewModal(false)}
            onOpen={(conv) => {
              setActiveConv(conv);
              loadConversations();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}