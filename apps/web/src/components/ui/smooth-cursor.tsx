import { FC, useEffect, useRef, useState } from "react";
import { motion, useSpring, useMotionValue } from "framer-motion";
import myPointer from "@/assets/cursors/my-pointer.svg";

interface Position {
  x: number;
  y: number;
}

export interface SmoothCursorProps {
  cursor?: React.ReactNode;
  springConfig?: {
    damping: number;
    stiffness: number;
    mass: number;
    restDelta: number;
  };
}

const DefaultCursorSVG: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={28}
      height={30}
      viewBox="0 0 50 54"
      fill="none"
    >
      <path
        d="M42.6817 41.1495L27.5103 6.79925C26.7269 5.02557 24.2082 5.02558 23.3927 6.79925L7.59814 41.1495C6.75833 42.9759 8.52712 44.8902 10.4125 44.1954L24.3757 39.0496C24.8829 38.8627 25.4385 38.8627 25.9422 39.0496L39.8121 44.1954C41.6849 44.8902 43.4884 42.9759 42.6817 41.1495Z"
        fill="white"
      />
    </svg>
  );
};

// Pointer Cursor
const PointerCursorSVG: FC = () => {
  return (
    <img
      src={myPointer}
      width={36}
      height={38}
      style={{
        pointerEvents: "none",
        userSelect: "none",
      }}
      draggable={false}
    />
  );
};

let globalMousePosition = { x: 0, y: 0 };

export function SmoothCursor({
  cursor = <DefaultCursorSVG />,
  springConfig = {
    damping: 45,
    stiffness: 400,
    mass: 1,
    restDelta: 0.001,
  },
}: SmoothCursorProps) {
  const lastMousePos = useRef<Position>({ x: 0, y: 0 });
  const velocity = useRef<Position>({ x: 0, y: 0 });
  const lastUpdateTime = useRef(Date.now());
  const previousAngle = useRef(0);
  const accumulatedRotation = useRef(0);
  const shakeCount = useRef(0);
  const hoveredButton = useRef<HTMLElement | null>(null);
  const [isPointer, setIsPointer] = useState(false);

const cursorX = useSpring(globalMousePosition.x, springConfig);
const cursorY = useSpring(globalMousePosition.y, springConfig);

  const rotationRaw = useMotionValue(0);

  const rotation = useSpring(rotationRaw, {
    damping: 25,
    stiffness: 120,
  });

  const scale = useSpring(1, {
    ...springConfig,
    stiffness: 500,
    damping: 35,
  });

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const updateVelocity = (currentPos: Position) => {
      const currentTime = Date.now();
      const deltaTime = currentTime - lastUpdateTime.current;

      if (deltaTime > 0) {
        velocity.current = {
          x: (currentPos.x - lastMousePos.current.x) / deltaTime,
          y: (currentPos.y - lastMousePos.current.y) / deltaTime,
        };
      }

      lastUpdateTime.current = currentTime;
      lastMousePos.current = currentPos;
    };

    const smoothMouseMove = (e: MouseEvent) => {
      const currentPos = { x: e.clientX, y: e.clientY };
      globalMousePosition = currentPos;
      // Detect if cursor is over a button or link
      const target = document.elementFromPoint(
        currentPos.x,
        currentPos.y,
      ) as HTMLElement | null;

      const button = target?.closest("button, a") as HTMLElement | null;

      hoveredButton.current = button ?? null;
      setIsPointer(!!button);

      if (button) {
        scale.set(1.15);

        // fully reset rotation state
        previousAngle.current = 0;
        accumulatedRotation.current = 0;
        // instantly stop spring velocity
        rotationRaw.set(0);
      } else {
        scale.set(1);
      }
      updateVelocity(currentPos);

      const speed = Math.sqrt(
        velocity.current.x ** 2 + velocity.current.y ** 2,
      );

      if (hoveredButton.current) {
        const rect = hoveredButton.current.getBoundingClientRect();

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // strength controls how strong magnet is (0.1 – 0.3 ideal)
        const dx = centerX - currentPos.x;
        const dy = centerY - currentPos.y;

        const distance = Math.sqrt(dx * dx + dy * dy);

        // limit magnet radius (in px)
        const maxDistance = 120;

        // dynamic strength (stronger when closer)
        const strength = Math.max(0, 1 - distance / maxDistance) * 0.25;

        const magneticX = currentPos.x + dx * strength;
        const magneticY = currentPos.y + dy * strength;

        cursorX.set(magneticX);
        cursorY.set(magneticY);
      } else {
        cursorX.set(currentPos.x);
        cursorY.set(currentPos.y);
      }


      // 🔥 macOS-style shake detection (only when NOT hovering button)
      if (!hoveredButton.current) {
        if (speed > 5) {
          shakeCount.current += 1;
        } else {
          shakeCount.current = Math.max(0, shakeCount.current - 1);
        }

        if (shakeCount.current > 4) {
          scale.set(2);

          if (timeout) clearTimeout(timeout);

          timeout = setTimeout(() => {
            scale.set(1);
            shakeCount.current = 0;
          }, 220);

          return;
        }
      }

      // Normal rotation only
      if (!hoveredButton.current && speed > 0.1) {
        const currentAngle =
          Math.atan2(velocity.current.y, velocity.current.x) * (180 / Math.PI) +
          90;

        let angleDiff = currentAngle - previousAngle.current;
        if (angleDiff > 180) angleDiff -= 360;
        if (angleDiff < -180) angleDiff += 360;

        accumulatedRotation.current += angleDiff;
        rotationRaw.set(accumulatedRotation.current);
        previousAngle.current = currentAngle;
      }
    };;;

    let rafId: number;

    const throttledMouseMove = (e: MouseEvent) => {
      if (rafId) return;

      rafId = requestAnimationFrame(() => {
        smoothMouseMove(e);
        rafId = 0;
      });
    };

    document.documentElement.style.cursor = "none";
    window.addEventListener("mousemove", throttledMouseMove);



    return () => {
      window.removeEventListener("mousemove", throttledMouseMove);
      document.documentElement.style.cursor = "auto";
      if (rafId) cancelAnimationFrame(rafId);
      if (timeout) clearTimeout(timeout);
    };
  }, [cursorX, cursorY, rotation, scale]);

  return (
    <motion.div
      style={{
        position: "fixed",
        left: cursorX,
        top: cursorY,
        translateX: "-50%",
        translateY: "-50%",
        rotate: rotation,
        scale,
        pointerEvents: "none",
        zIndex: 9999,
        willChange: "transform",
      }}
    >
      {isPointer ? <PointerCursorSVG /> : cursor}
    </motion.div>
  );
}
