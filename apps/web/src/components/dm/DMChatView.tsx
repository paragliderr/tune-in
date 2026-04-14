import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smile, Paperclip, Camera, Mic, Send, ArrowLeft, MoreVertical, X, Maximize2, CheckCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import type { Conversation, Message } from "./DMPage";

interface DMChatViewProps {
  conversation: Conversation;
  messages: Message[];
  onBack: () => void;
}

const MessageBubble = ({ 
  message, 
  index, 
  onImageClick,
  recipientLastRead,
  isGrouped,
  isLastMessage
}: { 
  message: Message; 
  index: number; 
  onImageClick: (url: string) => void;
  recipientLastRead: string | null;
  isGrouped: boolean;
  isLastMessage: boolean;
}) => {
  const isMe = message.sender === "me";

  const isRead =
    isMe &&
    recipientLastRead &&
    message.createdAt &&
    new Date(message.createdAt) <= new Date(recipientLastRead);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.05,
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
      className={`flex ${isMe ? "justify-end" : "justify-start"} group ${
        isGrouped ? "mb-1" : "mb-4"
      }`}
    >
      <div className={`max-w-[85%] sm:max-w-[70%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
        
        <motion.div
          whileHover={{ scale: 1.01 }}
          className={`overflow-hidden rounded-2xl relative shadow-sm border border-white/5 ${
            isMe
              ? "bg-white text-black"
              : "bg-zinc-800/80 text-white backdrop-blur-md"
          } ${isMe ? "rounded-br-none" : "rounded-bl-none"}`}
        >
          {message.text && (
            <div className="px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
              {message.text}
            </div>
          )}
          {message.image_url && (
            <div 
              className="max-w-full overflow-hidden cursor-zoom-in group-relative"
              onClick={() => onImageClick(message.image_url!)}
            >
              <img 
                src={message.image_url} 
                alt="Shared" 
                className="max-h-[300px] w-auto object-cover hover:scale-[1.02] transition-transform duration-500"
              />
            </div>
          )}
        </motion.div>

        {/* ⏱ TIME */}
        {!isGrouped && (
          <span className="text-[10px] text-muted-foreground/60 px-1 mt-1 font-medium flex items-center gap-1">
            {message.time}
            {isMe && (
              <CheckCheck className={`w-3 h-3 ${isRead ? "text-blue-500" : "text-zinc-500"}`} />
            )}
          </span>
        )}

        {/* 👁 SEEN LABEL */}
        {isMe && isLastMessage && isRead && (
          <span className="text-[10px] text-blue-400 mt-1 pr-1 font-medium">
            Seen
          </span>
        )}
      </div>
    </motion.div>
  );
};

const EMOJIS = ["😀", "😂", "🤣", "😊", "😍", "🎉", "🔥", "✨", "❤️", "👍", "🙌", "🤔", "👀", "🚀", "💯", "😭"];


const DMChatView = ({ conversation, onBack }: DMChatViewProps) => {
  const [inputValue, setInputValue] = useState("");
  const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
   const [recipientLastRead, setRecipientLastRead] = useState<string | null>(null);
  const [myLastReadAt, setMyLastReadAt] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const typingSendTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingReceiveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingChannelRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  useEffect(() => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }, 50);
  }, [displayMessages]);

  useEffect(() => {
    if (!conversation.id || !currentUserId) return;

    const channel = supabase.channel(`typing-${conversation.id}`);

    typingChannelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId === currentUserId) return;

        setIsTyping(true);

        // clear previous decay
        if (typingReceiveTimeoutRef.current) {
          clearTimeout(typingReceiveTimeoutRef.current);
        }

        typingReceiveTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
        }, 1500);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, currentUserId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      setShowScrollDown(!nearBottom);
    };

    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  const fetchMessages = async () => {
    if (!conversation.id || conversation.id.startsWith("new_")) {
      setDisplayMessages([]);
      return;
    }

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    const formatted: Message[] = data.map((m) => ({
      id: m.id,
      text: m.content,
      sender: m.sender_id === currentUserId ? "me" : "them",
      image_url: m.image_url,
      createdAt: m.created_at,
      time: new Date(m.created_at).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
    }));

    setDisplayMessages(formatted);
  };

  useEffect(() => {
    fetchMessages();

    // Fetch Recipient's last_read_at
    const fetchRecipientRead = async () => {
      if (!conversation.id || conversation.id.startsWith("new_") || !currentUserId) return;
      
      const { data } = await supabase
        .from("conversation_participants")
        .select("last_read_at")
        .eq("conversation_id", conversation.id)
        .neq("user_id", currentUserId)
        .single();
      
      if (data)      setRecipientLastRead(data.last_read_at);
    };

    const fetchMyRead = async () => {
      const { data } = await supabase
        .from("conversation_participants")
        .select("last_read_at")
        .eq("conversation_id", conversation.id)
        .eq("user_id", currentUserId)
        .single();

      if (data) setMyLastReadAt(data.last_read_at);
    };

    fetchRecipientRead();
    fetchMyRead();
  }, [conversation.id, currentUserId]);

  // Realtime subscription
  useEffect(() => {
    if (!conversation.id || conversation.id.startsWith("new_") || !currentUserId) return;

    const channel = supabase
      .channel(`chat-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const m = payload.new;
          // check if we already have this message (prevent double render on local send)
          setDisplayMessages((prev: Message[]) => {
  if (prev.some((p) => p.id === m.id)) return prev;

  const newMessage: Message = {
    id: m.id,
    text: m.content,
    sender: m.sender_id === currentUserId ? "me" : "them",
    image_url: m.image_url,
    createdAt: m.created_at,
    time: new Date(m.created_at).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
  };

  const updated = [...prev, newMessage];

  requestAnimationFrame(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  });

  return updated;
});
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, currentUserId]);

  // Realtime subscription for recipient read status
  useEffect(() => {
    if (!conversation.id || conversation.id.startsWith("new_") || !currentUserId) return;

    const channel = supabase
      .channel(`read-receipts-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          if (payload.new.user_id !== currentUserId) {
            setRecipientLastRead(payload.new.last_read_at);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, currentUserId]);

  // Mark as read when conversation is opened and periodically
  useEffect(() => {
    if (!conversation.id || conversation.id.startsWith("new_") || !currentUserId) return;

    const markAsRead = async () => {
      try {
        await supabase
          .from("conversation_participants")
          .update({ last_read_at: new Date().toISOString() })
          .eq("conversation_id", conversation.id)
          .eq("user_id", currentUserId);
      } catch (err) {
        console.error("Error marking as read:", err);
      }
    };

    // ✅ Run immediately
    markAsRead();

    // ✅ ALSO run whenever new messages come or periodically
    const interval = setInterval(markAsRead, 2000); 

    return () => clearInterval(interval);
  }, [conversation.id, currentUserId]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleEmojiSelect = (emoji: string) => {
    setInputValue((prev) => prev + emoji);
    // Keep focus or close picker? Usually keep open for multiple? Let's close for simplicity or keep open.
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUserId) return;

    try {
      setIsUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${currentUserId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("dm-attachments")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("dm-attachments")
        .getPublicUrl(filePath);

      // Send message with image
      let convoId = conversation.id;
      if (convoId.startsWith("new_")) {
        const { data: newConvo, error: convoError } = await supabase
          .from("conversations")
          .insert({})
          .select()
          .single();

        if (convoError || !newConvo) throw convoError;
        convoId = newConvo.id;

        await supabase.from("conversation_participants").insert([
          { conversation_id: convoId, user_id: currentUserId },
          { conversation_id: convoId, user_id: conversation.userId },
        ]);
      }

      const { error: msgError } = await supabase.from("messages").insert({
        conversation_id: convoId,
        sender_id: currentUserId,
        content: inputValue.trim() || "", // can be empty if only image
        image_url: publicUrl,
      });

      if (msgError) throw msgError;
      setInputValue("");
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !currentUserId) return;

    try {
      let convoId = conversation.id;

      // 🧠 If it's a new convo → create it
      if (convoId.startsWith("new_")) {
        const { data: newConvo, error: convoError } = await supabase
          .from("conversations")
          .insert({})
          .select()
          .single();

        if (convoError || !newConvo) throw convoError;
        convoId = newConvo.id;

        const { error: partError } = await supabase.from("conversation_participants").insert([
          { conversation_id: convoId, user_id: currentUserId },
          { conversation_id: convoId, user_id: conversation.userId },
        ]);

        if (partError) throw partError;
      }

      // 📩 Insert message
      const { error } = await supabase.from("messages").insert({
        conversation_id: convoId,
        sender_id: currentUserId,
        content: inputValue.trim(),
      });

      if (error) throw error;
      setInputValue("");
    } catch (err) {
      console.error("Send failed:", err);
    }
  };


  const formatDay = (dateStr?: string) => {
    if (!dateStr) return "";

    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return date.toLocaleDateString([], {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const unreadIndex = displayMessages.findIndex((msg) => {
    if (!myLastReadAt || msg.sender === "me") return false;
    return new Date(msg.createdAt!) > new Date(myLastReadAt);
  });

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col h-full bg-black relative"
    >
      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 sm:p-10"
            onClick={() => setPreviewImage(null)}
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setPreviewImage(null)}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-[101]"
            >
              <X className="text-white w-6 h-6" />
            </motion.button>
            <motion.div
              layoutId="preview"
              className="relative max-w-full max-h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewImage}
                alt="Full preview"
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-between px-5 py-3 border-b border-border bg-black/60 backdrop-blur-xl shrink-0"
      >
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden mr-1 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Link to={`/user/${conversation.username}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <motion.div
              whileHover={{ scale: 1.08 }}
              className="relative"
            >
              <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-xs font-semibold text-foreground overflow-hidden">
                {conversation.avatar}
              </div>
              <AnimatePresence mode="wait">
                {conversation.online ? (
                  <motion.div
                    key="online"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background"
                  />
                ) : (
                  <motion.div
                    key="offline"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-muted-foreground/60 border-2 border-background"
                  />
                )}
              </AnimatePresence>
            </motion.div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">{conversation.name}</h3>
              <AnimatePresence mode="wait">
                {conversation.online ? (
                  <motion.p
                    key="online-text"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="text-xs text-emerald-400"
                  >
                    Online
                  </motion.p>
                ) : (
                  <motion.p
                    key="offline-text"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="text-xs text-muted-foreground"
                  >
                    Offline
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </Link>
        </div>

        <button className="text-muted-foreground hover:text-foreground transition-colors p-2">
          <MoreVertical className="w-5 h-5" />
        </button>
      </motion.div>

      {/* Messages area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto px-5 scrollbar-hide flex flex-col"
      >
        <div className="mt-auto">
          {displayMessages.map((msg, i) => {
            const prevMsg = displayMessages[i - 1];

            const showDaySeparator =
              !prevMsg ||
              new Date(prevMsg.createdAt!).toDateString() !==
                new Date(msg.createdAt!).toDateString();

            const isGrouped =
              prevMsg &&
              prevMsg.sender === msg.sender &&
              new Date(msg.createdAt!).toDateString() === new Date(prevMsg.createdAt!).toDateString() &&
              new Date(msg.createdAt!).getTime() -
                new Date(prevMsg.createdAt!).getTime() <
                5 * 60 * 1000;

            const isLastMessage = i === displayMessages.length - 1;

            return (
              <div key={msg.id}>
                {/* 📅 DAY */}
                {showDaySeparator && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center my-4"
                  >
                    <span className="text-[11px] text-muted-foreground bg-zinc-800/60 px-3 py-1 rounded-full backdrop-blur-md shadow-sm">
                      {formatDay(msg.createdAt)}
                    </span>
                  </motion.div>
                )}

                {/* 🔴 UNREAD */}
                {i === unreadIndex && unreadIndex !== -1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 my-4 px-4"
                  >
                    <div className="flex-1 h-[1px] bg-red-500/30" />
                    <span className="text-[10px] text-red-400 font-semibold tracking-wider">
                      UNREAD MESSAGES
                    </span>
                    <div className="flex-1 h-[1px] bg-red-500/30" />
                  </motion.div>
                )}

                <MessageBubble
                  message={msg}
                  index={displayMessages.length - 1 === i ? 0 : i}
                  onImageClick={setPreviewImage}
                  recipientLastRead={recipientLastRead}
                  isGrouped={!!isGrouped}
                  isLastMessage={isLastMessage}
                />
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <AnimatePresence>
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-5 py-2 text-sm text-muted-foreground flex items-center gap-2"
          >
            <span className="text-white/70 italic tracking-wide">typing...</span>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, delay: i * 0.2, duration: 0.8 }}
                  className="w-1.5 h-1.5 bg-white/60 rounded-full"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScrollDown && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={() => {
              bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            className="absolute bottom-24 right-6 bg-zinc-800/80 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-white text-xs font-semibold shadow-2xl hover:bg-zinc-700/80 transition-all z-[50]"
          >
            ↓ New messages
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input area */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="px-4 py-3 bg-black border-t border-zinc-800/50 shrink-0"
      >
        <div className="flex items-center gap-2 rounded-full bg-zinc-900/50 px-3 py-1.5 focus-within:bg-zinc-800/50 transition-all duration-300 relative">
          
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            accept="image/*"
            onChange={handleImageUpload}
          />

          <motion.button
            whileHover={{ scale: 1.15, rotate: 15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => fileInputRef.current?.click()}
            className="text-muted-foreground hover:text-foreground transition-colors px-2 disabled:opacity-50"
            disabled={isUploading}
          >
            <Paperclip className={`w-5 h-5 ${isUploading ? "animate-pulse" : ""}`} />
          </motion.button>

          <input
            type="text"
            placeholder={isUploading ? "Uploading image..." : "Type a message..."}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);

              if (!typingChannelRef.current) return;

              // debounce sender
              if (typingSendTimeoutRef.current) {
                clearTimeout(typingSendTimeoutRef.current);
              }

              typingSendTimeoutRef.current = setTimeout(() => {
                typingChannelRef.current.send({
                  type: "broadcast",
                  event: "typing",
                  payload: {
                    userId: currentUserId,
                  },
                });
              }, 250);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={isUploading}
            className="flex-1 bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
          />

          <div className="flex items-center gap-1 pr-1">
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <Smile className="w-5 h-5" />
              </motion.button>

              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div
                    ref={emojiPickerRef}
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    className="absolute bottom-full right-0 mb-4 p-3 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl grid grid-cols-4 gap-2 z-[100] w-48 backdrop-blur-xl"
                  >
                    {EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleEmojiSelect(emoji)}
                        className="text-xl hover:scale-125 transition-transform p-1"
                      >
                        {emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence mode="popLayout">
              {inputValue.trim() || isUploading ? (
                <motion.button
                  key="send"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleSend}
                  disabled={isUploading}
                  className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-black"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </motion.button>
              ) : (
                <motion.button
                  key="cam"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Camera className="w-5 h-5" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default DMChatView;
