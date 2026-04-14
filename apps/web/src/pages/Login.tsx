import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

import poster1 from "@/assets/poster-1.jpg";
import poster2 from "@/assets/poster-2.jpg";
import poster3 from "@/assets/poster-3.jpg";
import poster4 from "@/assets/poster-4.jpg";
import poster5 from "@/assets/poster-5.jpg";
import poster6 from "@/assets/poster-6.jpg";
import poster7 from "@/assets/poster-7.jpg";
import poster8 from "@/assets/poster-8.jpg";

const col1 = [poster1, poster4, poster7, poster2];
const col2 = [poster3, poster6, poster1, poster5];
const col3 = [poster5, poster8, poster3, poster6];

const ScrollingColumn = ({
  images,
  direction,
  duration,
}: {
  images: string[];
  direction: "up" | "down";
  duration: number;
}) => {
  const doubled = [...images, ...images];

  return (
    <div className="relative h-full overflow-hidden">
      <motion.div
        className="flex flex-col gap-4"
        animate={{
          y: direction === "up" ? ["0%", "-50%"] : ["-50%", "0%"],
        }}
        transition={{
          y: {
            repeat: Infinity,
            repeatType: "loop",
            duration,
            ease: "linear",
          },
        }}
      >
        {doubled.map((src, i) => (
          <div
            key={i}
            className="aspect-[2/3] rounded-2xl overflow-hidden poster-shadow flex-shrink-0"
          >
            <img
              src={src}
              alt="Activity"
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </motion.div>
    </div>
  );
};

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const handlePostLoginRedirect = async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .single();

    if (!profile || !profile.onboarding_completed) {
      navigate("/onboarding", { replace: true });
    } else {
      navigate("/home", { replace: true });
    }
  };

 useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user && window.location.pathname === "/login") {
          handlePostLoginRedirect(session.user.id);
        }
      },
    );

   return () => listener.subscription.unsubscribe();
 }, []);

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data?.user) {
      handlePostLoginRedirect(data.user.id);
    } else if (error) {
      alert(error.message);
    }
  };

const handleGoogleLogin = async () => {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/login`,
    },
  });
};

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left: Animated image wall */}
      <div className="hidden lg:flex w-1/2 h-screen overflow-hidden p-4 gap-4">
        <ScrollingColumn images={col1} direction="up" duration={25} />
        <ScrollingColumn images={col2} direction="down" duration={30} />
        <ScrollingColumn images={col3} direction="up" duration={28} />
      </div>

      {/* Right: Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-10">
            <Link
              to="/"
              className="text-foreground text-2xl font-bold tracking-cinematic uppercase font-display"
            >
              TUNE-IN
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-8">
            <h2 className="text-2xl font-bold text-foreground text-center mb-6">
              Login
            </h2>

            {/* Fields */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-300"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-300 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Login button */}
            <button
              onClick={handleLogin}
              className="w-full mt-6 py-3 rounded-full bg-primary text-primary-foreground font-medium tracking-wider uppercase text-sm hover:opacity-90 transition-all duration-300 glow-purple-subtle"
            >
              Login
            </button>

            <p className="text-center mt-4">
              <a href="#" className="text-primary text-sm hover:underline">
                Forgot Password?
              </a>
            </p>

            {/* OR divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">OR</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Google login */}
            <button
              onClick={handleGoogleLogin}
              className="w-full py-3 rounded-xl bg-white text-black font-medium flex items-center justify-center gap-3 hover:opacity-90 transition"
            >
              <img
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                className="w-5 h-5"
              />
              Continue with Google
            </button>
          </div>

          <p className="text-center text-muted-foreground text-sm mt-6">
            Don't have an account?{" "}
            <button
              onClick={() => navigate("/signup")}
              className="text-foreground font-semibold hover:text-primary transition-colors"
            >
              Sign Up
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
