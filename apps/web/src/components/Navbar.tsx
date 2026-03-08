import { motion, useScroll, useTransform } from "framer-motion";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { ScrollProgress } from "@/components/ui/scroll-progress";
import { TextAnimate } from "@/components/ui/text-animate";
import Logo from "@/assets/LOGO/Logo.svg";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";

const Navbar = () => {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const { scrollY } = useScroll();
  const navBg = useTransform(scrollY, [0, 200], [0, 1]);

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-5"
      style={{
        backgroundColor: useTransform(
          navBg,
          (v) => `hsla(0, 0%, 3%, ${v * 0.85})`,
        ),
        backdropFilter: useTransform(navBg, (v) => `blur(${v * 20}px)`),
      }}
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <Link
          to="/"
          className="flex items-center gap-3 cursor-pointer select-none"
        >
          {/* SVG Logo */}
          <img
            src={Logo}
            alt="TUNE-IN Logo"
            className="h-8 md:h-9 w-auto object-contain"
            draggable={false}
          />

          {/* Animated Text */}
          <TextAnimate
            animation="blurIn"
            by="character"
            as="span"
            delay={0.3}
            className="text-xl md:text-2xl font-bold tracking-cinematic uppercase"
          >
            tune-in
          </TextAnimate>
        </Link>
      </motion.div>

      {/* Buttons */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
        className="flex items-center gap-4"
      >
        <Link to="/about">
          <InteractiveHoverButton className="uppercase tracking-wider text-sm px-6 py-2 rounded-full">
            About
          </InteractiveHoverButton>
        </Link>

        <Link to="/login">
          <InteractiveHoverButton className="uppercase tracking-wider text-sm px-6 py-2 rounded-full">
            Login
          </InteractiveHoverButton>
        </Link>
      </motion.div>

      {isHome && <ScrollProgress className="h-[2px] top-[80px] bg-primary" />}
    </motion.nav>
  );
};

export default Navbar;
