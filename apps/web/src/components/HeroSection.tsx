import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const HeroSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.6, 0]);
  const blur = useTransform(scrollYProgress, [0, 0.4, 0.8], [0, 5, 15]);

  return (
    <div ref={ref} className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Animated radial glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[80vw] h-[80vh] radial-glow animate-glow-pulse" />
      </div>

      <motion.div
        className="relative z-10 text-center"
        style={{
          scale,
          opacity,
          filter: useTransform(blur, (v) => `blur(${v}px)`),
        }}
      >
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-[12vw] md:text-[8vw] font-bold tracking-cinematic text-foreground text-glow leading-none font-display"
        >
          TUNE-IN
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          className="mt-6 text-muted-foreground text-sm md:text-base tracking-wider uppercase"
        >
          Share what you do. Discover what others love.
        </motion.p>
      </motion.div>
    </div>
  );
};

export default HeroSection;
