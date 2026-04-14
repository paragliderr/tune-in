import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Navigate } from "react-router-dom";

const AuthGuard = ({ children }: any) => {
  const [loading, setLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      // ⭐ wait for session hydration
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setSessionUser(null);
        setLoading(false);
        return;
      }

      setSessionUser(session.user);

      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", session.user.id)
        .maybeSingle();

      // ⭐ profile row does not exist → create it
      if (error || !data) {
        await supabase.from("profiles").insert({
          id: session.user.id,
        });

        setOnboardingDone(false);
      } else {
        setOnboardingDone(data.onboarding_completed);
      }

      setLoading(false); // ⭐⭐ VERY IMPORTANT
    };

    check();
  }, []);

  // ⭐ prevent flicker
  if (loading) return null;

  // ⭐ not logged in
  if (!sessionUser) return <Navigate to="/login" replace />;

  // ⭐ onboarding not done
  if (!onboardingDone) return <Navigate to="/onboarding" replace />;

  return children;
};

export default AuthGuard;
