import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function useGlobalPresence() {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<any>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || joinedRef.current) return;

      const channel = supabase.channel("global-online", {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();

          const ids = new Set<string>();

          Object.keys(state).forEach((userId) => {
            if (state[userId]?.length > 0) {
              ids.add(userId);
            }
          });

          if (mounted) setOnlineUserIds(ids);
        })
        .subscribe(async (status: any) => {
          if (status === "SUBSCRIBED") {
            await channel.track({
              online_at: new Date().toISOString(),
            });
          }
        });

      channelRef.current = channel;
      joinedRef.current = true;
    };

    init();

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return { onlineUserIds };
}