import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function useGlobalPresence() {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    let channel: any = null;
    let cleanupVisibility: (() => void) | null = null;

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) return;

      channel = supabase.channel("global-online", {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          if (!mounted) return;
          const state = channel.presenceState();
          const ids = new Set<string>();

          Object.keys(state).forEach((userId) => {
            if (state[userId] && Array.isArray(state[userId]) && state[userId].length > 0) {
              ids.add(userId);
            }
          });

          setOnlineUserIds(ids);
        })
        .subscribe(async (status: any) => {
          if (status === "SUBSCRIBED" && mounted) {
            await channel.track({
              online_at: new Date().toISOString(),
              last_seen: new Date().toISOString(),
            });
          }
        });

      // Track visibility to re-ping when returning to the app
      const handleVisibilityChange = async () => {
        if (document.visibilityState === 'visible' && channel && mounted) {
          try {
            await channel.track({
              online_at: new Date().toISOString(),
              last_seen: new Date().toISOString(),
            });
          } catch (err) {
            console.error("Visibility track failed:", err);
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      cleanupVisibility = () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    };

    init();

    return () => {
      mounted = false;
      if (cleanupVisibility) cleanupVisibility();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return { onlineUserIds };
}