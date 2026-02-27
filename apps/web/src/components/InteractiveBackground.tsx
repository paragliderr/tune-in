import { useEffect, useRef } from "react";

const InteractiveBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    alpha: number;
    baseAlpha: number;
  }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = document.documentElement.scrollHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Create particles
    const count = 80;
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 1,
      alpha: Math.random() * 0.3 + 0.05,
      baseAlpha: Math.random() * 0.3 + 0.05,
    }));

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY + window.scrollY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      particlesRef.current.forEach((p) => {
        const dx = mx - p.x;
        const dy = my - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = Math.max(0, 1 - dist / 250);

        // Attract slightly toward cursor
        p.vx += dx * influence * 0.0001;
        p.vy += dy * influence * 0.0001;

        // Damping
        p.vx *= 0.99;
        p.vy *= 0.99;

        p.x += p.vx;
        p.y += p.vy;

        // Wrap around
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Glow near cursor
        p.alpha = p.baseAlpha + influence * 0.6;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + influence * 3, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(263, 70%, 58%, ${p.alpha})`;
        ctx.fill();

        // Draw connections near cursor
        if (influence > 0.2) {
          particlesRef.current.forEach((p2) => {
            const d = Math.sqrt((p.x - p2.x) ** 2 + (p.y - p2.y) ** 2);
            if (d < 120 && d > 0) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `hsla(263, 70%, 58%, ${0.08 * (1 - d / 120)})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          });
        }
      });

      // Cursor glow
      const gradient = ctx.createRadialGradient(mx, my, 0, mx, my, 200);
      gradient.addColorStop(0, "hsla(263, 70%, 58%, 0.08)");
      gradient.addColorStop(1, "hsla(263, 70%, 58%, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(mx - 200, my - 200, 400, 400);

      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ width: "100%", height: "100%" }}
    />
  );
};

export default InteractiveBackground;
