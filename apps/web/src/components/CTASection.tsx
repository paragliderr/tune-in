import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const CTASection = () => {
  return (
    <section className="relative z-20 py-32 px-4 md:px-12">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-4xl md:text-6xl font-bold text-foreground font-display tracking-wide leading-tight">
            Ready to tune in?
          </h2>
          <p className="mt-6 text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            Join thousands of people sharing their passions, tracking activities, and discovering new ways to connect.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login" className="px-8 py-3 rounded-full bg-primary text-primary-foreground font-medium tracking-wider uppercase text-sm hover:opacity-90 transition-opacity duration-300 glow-purple-subtle">
              Get Started
            </Link>
            <Link to="/about" className="px-8 py-3 rounded-full border border-border text-foreground font-medium tracking-wider uppercase text-sm hover:border-primary/60 transition-colors duration-300">
              Learn More
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
