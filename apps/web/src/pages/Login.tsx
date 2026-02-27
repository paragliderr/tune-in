import { motion } from "framer-motion";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

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
  const [tab, setTab] = useState<"username" | "phone">("username");

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
            <Link to="/" className="text-foreground text-2xl font-bold tracking-cinematic uppercase font-display">
              TUNE-IN
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-8">
            <h2 className="text-2xl font-bold text-foreground text-center mb-6">Login</h2>

            {/* Tabs */}
            <div className="flex rounded-full border border-border mb-6 overflow-hidden">
              <button
                onClick={() => setTab("username")}
                className={`flex-1 py-2.5 text-sm font-medium tracking-wider uppercase transition-all duration-300 ${
                  tab === "username"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Username
              </button>
              <button
                onClick={() => setTab("phone")}
                className={`flex-1 py-2.5 text-sm font-medium tracking-wider uppercase transition-all duration-300 ${
                  tab === "phone"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Phone
              </button>
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  {tab === "username" ? "Username" : "Phone Number"}
                </label>
                <input
                  type={tab === "phone" ? "tel" : "text"}
                  placeholder={tab === "username" ? "Enter your username" : "Enter your phone number"}
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
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-300 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Login button */}
            <button className="w-full mt-6 py-3 rounded-full bg-primary text-primary-foreground font-medium tracking-wider uppercase text-sm hover:opacity-90 transition-all duration-300 glow-purple-subtle">
              Login
            </button>

            <p className="text-center mt-4">
              <a href="#" className="text-primary text-sm hover:underline">
                Forgot Password?
              </a>
            </p>
          </div>

          <p className="text-center text-muted-foreground text-sm mt-6">
            Don't have an account?{" "}
            <a href="#" className="text-foreground font-semibold hover:text-primary transition-colors">
              Sign Up
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
