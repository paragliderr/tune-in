import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// --- GLOBAL STATE (Survives Page Navigation) ---
let globalChannel: any = null;
let isInitializing = false;
let cachedOnlineUsers = new Set<string>();
const listeners = new Set<React.Dispatch<React.SetStateAction<Set<string>>>>();
let visibilityAttached = false;

export default function useGlobalPresence() {
  // Initialize with the cached users so the UI doesn't blink "offline" during navigation
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(cachedOnlineUsers);

  useEffect(() => {
    let mounted = true;

    // 1. Register this component to receive real-time updates
    listeners.add(setOnlineUserIds);

    // 2. Immediately apply any existing data to ensure instant sync
    setOnlineUserIds(new Set(cachedOnlineUsers));

    const init = async () => {
      // If the channel is already running, or currently starting up, stop here.
      // This prevents the "duplicate channel" bug.
      if (globalChannel || isInitializing) return;
      
      isInitializing = true;

      try {
        // Your exact original Auth logic
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || !mounted) return;

        // Create the channel exactly ONCE
        globalChannel = supabase.channel("global-online", {
          config: {
            presence: {
              key: user.id,
            },
          },
        });

        globalChannel
          .on("presence", { event: "sync" }, () => {
            if (!globalChannel) return;

            const state = globalChannel.presenceState();
            const ids = new Set<string>();

            Object.keys(state).forEach((userId) => {
              if (state[userId] && Array.isArray(state[userId]) && state[userId].length > 0) {
                ids.add(userId);
              }
            });

            // Update the global cache
            cachedOnlineUsers = ids;
            
            // Push the update to every mounted component (Home, DMPage, Sidebar)
            listeners.forEach((setFn) => setFn(new Set(ids)));
          })
          .subscribe(async (status: any) => {
            if (status === "SUBSCRIBED" && globalChannel && mounted) {
              try {
                await globalChannel.track({
                  online_at: new Date().toISOString(),
                  last_seen: new Date().toISOString(),
                });
              } catch (err) {
                console.error("Presence track failed:", err);
              }
            }
          });

        // Attach the visibility listener globally, exactly ONCE
        if (!visibilityAttached) {
          visibilityAttached = true;
          document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && globalChannel) {
              try {
                await globalChannel.track({
                  online_at: new Date().toISOString(),
                  last_seen: new Date().toISOString(),
                });
              } catch (err) {
                console.error("Visibility track failed:", err);
              }
            }
          });
        }
      } catch (error) {
        console.error("Presence initialization failed:", error);
      } finally {
        isInitializing = false;
      }
    };

    init();

    return () => {
      mounted = false;
      
      // 3. CLEANUP: Only remove this specific component from the listener list.
      // WE DO NOT CALL supabase.removeChannel(globalChannel) HERE!
      // This allows the connection to stay perfectly alive while you navigate pages.
      listeners.delete(setOnlineUserIds);
    };
  }, []);

  return { onlineUserIds };
}