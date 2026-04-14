import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import DMSidebar from "../dm/DMSidebar";
import DMChatView from "../dm/DMChatView";
import DMEmptyState from "../dm/DMEmptyState";

export interface Message {
  id: string;
  text: string;
  sender: "me" | "them";
  time: string;
  image_url?: string;
  createdAt?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  name: string;
  username: string;
  avatar: string;
  online: boolean;
  time: string;
  lastMessage: string;
  lastMessageAt: string | null;
  unread: number;
}

interface DMPageProps {
  messageUsername?: string;
  onlineUserIds: Set<string>;
}

export default function DMPage({ messageUsername, onlineUserIds }: DMPageProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [people, setPeople] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const selectedConvoRef = useRef<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUserId(session.user.id);
      }
    });
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const loadConversations = async () => {
      setLoading(true);

      // 1. Get conversations the current user is in
      const { data: myConvos } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", currentUserId);

      const convoIds = myConvos?.map((c) => c.conversation_id) || [];

      let otherUserIds: string[] = [];
      let convoMap: Record<string, string> = {}; // userId -> conversationId

      if (convoIds.length > 0) {
        // 2. Get the other participants
        const { data: otherParticipants } = await supabase
          .from("conversation_participants")
          .select("conversation_id, user_id")
          .in("conversation_id", convoIds)
          .neq("user_id", currentUserId);

        if (otherParticipants) {
          otherParticipants.forEach((p) => {
            otherUserIds.push(p.user_id);
            convoMap[p.user_id] = p.conversation_id;
          });
        }
      }

      // 3. If there's a specific messageUsername passed via URL, we definitely need their profile
      let targetProfile = null;
      if (messageUsername) {
        const { data: targetData } = await supabase
          .from("profiles")
          .select("*")
          .eq("username", messageUsername)
          .single();
        
        if (targetData) {
          targetProfile = targetData;
          if (!otherUserIds.includes(targetData.id)) {
            otherUserIds.push(targetData.id);
            // new conversation -> no convoMap entry yet
          }
        }
      }

      // 4. Fetch profiles for everyone
      if (otherUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", otherUserIds);

        // 5. Fetch latest messages for each conversation
        const { data: latestMsgs } = await supabase
          .from("messages")
          .select("conversation_id, content, image_url, created_at")
          .in("conversation_id", convoIds)
          .order("created_at", { ascending: false });

        const latestMap: Record<string, any> = {};
        if (latestMsgs) {
          latestMsgs.forEach((m) => {
            if (!latestMap[m.conversation_id]) {
              latestMap[m.conversation_id] = m;
            }
          });
        }

        // 6. Fetch UNREAD counts for each conversation
        const unreadCountsMap: Record<string, number> = {};
        
        // 1. Get user's last_read_at for all their convos
        const { data: myParticipants } = await supabase
          .from("conversation_participants")
          .select("conversation_id, last_read_at")
          .eq("user_id", currentUserId);

        if (myParticipants && myParticipants.length > 0) {
          const countPromises = myParticipants.map(async (p) => {
            const { count: unreadCount } = await supabase
              .from("messages")
              .select("*", { count: 'exact', head: true })
              .eq("conversation_id", p.conversation_id)
              .gt("created_at", p.last_read_at || "1970-01-01")
              .neq("sender_id", currentUserId);
            
            unreadCountsMap[p.conversation_id] = unreadCount || 0;
          });
          await Promise.all(countPromises);
        }

        if (profiles) {
          const loadedPeople: Conversation[] = profiles.map((p) => {
            const convoId = convoMap[p.id];
            const lastMsg = convoId ? latestMap[convoId] : null;
            const unreadCount = convoId ? unreadCountsMap[convoId] : 0;

            let lastMsgText = "Tap to chat";
            if (lastMsg) {
              if (lastMsg.image_url && (!lastMsg.content || lastMsg.content === "")) {
                lastMsgText = "📷 Image";
              } else if (lastMsg.image_url) {
                lastMsgText = `📷 ${lastMsg.content}`;
              } else {
                lastMsgText = lastMsg.content;
              }
              // Truncate
              if (lastMsgText.length > 30) {
                lastMsgText = lastMsgText.substring(0, 27) + "...";
              }
            }

            return {
              id: convoId || `new_${p.id}`,
              userId: p.id,
              name: p.username || "Unknown",
              username: p.username || "unknown",
              avatar: p.avatar_url ? (
                <img src={p.avatar_url} alt={p.username} className="w-full h-full object-cover rounded-full" />
              ) : p.username?.charAt(0).toUpperCase() || "?",
              online: false, 
              time: lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now",
              lastMessage: lastMsgText,
              lastMessageAt: lastMsg ? lastMsg.created_at : null,
              unread: unreadCount,
            };
          });

          setPeople(loadedPeople);

          // Auto-select if requested
          if (targetProfile) {
            const found = loadedPeople.find((lp) => lp.userId === targetProfile.id);
            if (found) {
              setSelectedConvo(found);
              selectedConvoRef.current = found;
            }
          }
        }
      }

      setLoading(false);
    };

    loadConversations();

    // 🔄 Subscribe to updates to refresh sidebar
    const channel = supabase
      .channel("sidebar-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const msg = payload.new;

          setPeople((prev) =>
            prev.map((p) => {
              if (p.id !== msg.conversation_id) return p;

              // ❌ If currently open -> DON'T increase unread
              if (selectedConvoRef.current?.id === p.id) {
                return {
                  ...p,
                  lastMessage: msg.content || "📷 Image",
                  time: new Date(msg.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                };
              }

              // ✅ Otherwise increase unread
              return {
                ...p,
                unread: (p.unread || 0) + 1,
                lastMessage: msg.content || "📷 Image",
                time: new Date(msg.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              };
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${currentUserId}`,
        },
        () => loadConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, messageUsername]);

  // Update online status reactively Based on Global Presence
  const reactivePeople = people.map((p) => ({
    ...p,
    online: onlineUserIds.has(p.userId),
  }));

  const handleSelect = (c: Conversation) => {
    setSelectedConvo(c);
    selectedConvoRef.current = c;

    // 🔥 instantly clear unread locally (no wait for DB)
    setPeople((prev) =>
      prev.map((p) => (p.id === c.id ? { ...p, unread: 0 } : p))
    );
  };

  const filteredPeople = reactivePeople.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-background">
      {/* Sidebar - hidden on mobile if convo is selected */}
      <div
        className={`${
          selectedConvo ? "hidden md:flex" : "flex"
        } h-full shrink-0`}
      >
        <DMSidebar
          people={filteredPeople}
          selectedId={selectedConvo?.id || null}
          onSelect={handleSelect}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 min-w-0 flex flex-col h-full bg-muted/10 relative">
        {selectedConvo ? (
          <DMChatView
            conversation={filteredPeople.find(p => p.id === selectedConvo.id) || selectedConvo}
            messages={[]} // Placeholder until real messages are fetched
            onBack={() => setSelectedConvo(null)}
          />
        ) : (
          <DMEmptyState />
        )}
      </div>
    </div>
  );
}
