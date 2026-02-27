const Footer = () => {
  return (
    <footer className="relative z-20 border-t border-border py-12 px-4 md:px-12">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <span className="text-foreground font-bold tracking-cinematic uppercase text-sm font-display">
          TUNE-IN
        </span>
        <p className="text-muted-foreground text-xs tracking-wide">
          © {new Date().getFullYear()} Tune-In. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
