import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { img, type TMDBMovie } from "@/lib/tmdb";

interface MovieCardProps {
  movie: TMDBMovie;
  index: number;
  onClick: () => void;
}

const MovieCard = ({ movie, index, onClick }: MovieCardProps) => {
  const title = movie.title || movie.name || "Untitled";
  const year = (movie.release_date || movie.first_air_date || "").slice(0, 4);
  const type = movie.media_type === "tv" || movie.first_air_date ? "Show" : "Movie";
  const poster = img(movie.poster_path, "w342");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      whileHover={{ scale: 1.03, y: -4 }}
      onClick={onClick}
      className="group cursor-pointer flex-shrink-0 w-[160px] md:w-[180px]"
    >
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-muted/30 border border-border/30 group-hover:border-primary/40 transition-all duration-300 group-hover:shadow-[0_0_20px_hsl(var(--primary)/0.15)]">
        {poster ? (
          <img
            src={poster}
            alt={title}
            className="w-full h-full object-cover transition-all duration-500 group-hover:brightness-110"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
            <span className="text-muted-foreground text-xs text-center px-2">{title}</span>
          </div>
        )}
        {/* Rating badge */}
        {movie.vote_average > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-background/80 backdrop-blur-md rounded-full px-1.5 py-0.5 text-xs">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-foreground font-medium">{movie.vote_average.toFixed(1)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <div className="mt-2 px-1">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        <p className="text-xs text-muted-foreground">
          {type} {year && `· ${year}`}
        </p>
      </div>
    </motion.div>
  );
};

export default MovieCard;
