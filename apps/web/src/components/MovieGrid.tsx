import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

import poster1 from "@/assets/poster-1.jpg";
import poster2 from "@/assets/poster-2.jpg";
import poster3 from "@/assets/poster-3.jpg";
import poster4 from "@/assets/poster-4.jpg";
import poster5 from "@/assets/poster-5.jpg";
import poster6 from "@/assets/poster-6.jpg";
import poster7 from "@/assets/poster-7.jpg";
import poster8 from "@/assets/poster-8.jpg";

const posters = [poster1, poster2, poster3, poster4, poster5, poster6, poster7, poster8];

const columns = [
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
] as const;

const PosterCard = ({
  src,
  index,
}: {
  src: string;
  index: number;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.7,
        delay: index * 0.08,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="group relative aspect-[2/3] rounded-poster overflow-hidden poster-shadow cursor-pointer"
    >
      <img
        src={src}
        alt="Movie poster"
        className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105 group-hover:brightness-110"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </motion.div>
  );
};

const MovieGrid = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);

  return (
    <div ref={ref} className="relative -mt-48 z-20 pb-32">
      <motion.div
        style={{ y }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 px-4 md:px-12 max-w-7xl mx-auto"
      >
        {columns.map((col, colIndex) => (
          <div
            key={colIndex}
            className="flex flex-col gap-4 md:gap-6"
            style={{ marginTop: colIndex % 2 === 1 ? "3rem" : "0" }}
          >
            {col.map((posterIndex) => (
              <PosterCard
                key={posterIndex}
                src={posters[posterIndex]}
                index={posterIndex}
              />
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default MovieGrid;
