import { motion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";

const Navbar = () => {
  const { scrollY } = useScroll();
  const navBg = useTransform(scrollY, [0, 200], [0, 1]);

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-5"
      style={{
        backgroundColor: useTransform(navBg, (v) =>
          `hsla(0, 0%, 3%, ${v * 0.85})`
        ),
        backdropFilter: useTransform(navBg, (v) =>
          `blur(${v * 20}px)`
        ),
      }}
    >
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-foreground text-lg font-bold tracking-cinematic uppercase"
      >
        TUNE-IN
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
        className="flex items-center gap-6"
      >
        <Link
          to="/about"
          className="group relative px-6 py-2 rounded-full border border-primary/60 text-foreground text-sm font-medium tracking-wider uppercase overflow-hidden transition-all duration-300 hover:glow-purple-subtle hover:border-primary"
        >
          <span className="absolute inset-0 bg-primary origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out" />
          <span className="relative z-10 group-hover:text-primary-foreground transition-colors duration-300">
            About
          </span>
        </Link>
        <Link
          to="/login"
          className="group relative px-6 py-2 rounded-full border border-primary/60 text-foreground text-sm font-medium tracking-wider uppercase overflow-hidden transition-all duration-300 hover:glow-purple-subtle hover:border-primary"
        >
          <span className="absolute inset-0 bg-primary origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out" />
          <span className="relative z-10 group-hover:text-primary-foreground transition-colors duration-300">
            Login
          </span>
        </Link>
      </motion.div>
    </motion.nav>
  );
};

export default Navbar;
