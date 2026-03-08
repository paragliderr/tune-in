import { FC, useEffect, useState } from "react";
import { motion, useSpring } from "framer-motion";
import myPointer from "@/assets/cursors/my-pointer.svg";
let globalMousePosition = { x: -100, y: -100 }; // offscreen initially

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

export function SmoothCursor({
  cursor = <DefaultCursorSVG />,
  springConfig = {
    damping: 45,
    stiffness: 400,
    mass: 1,
    restDelta: 0.001,
  },
}: SmoothCursorProps) {
  const cursorX = useSpring(globalMousePosition.x, springConfig);
  const cursorY = useSpring(globalMousePosition.y, springConfig);
  const scale = useSpring(1, {
    damping: 35,
    stiffness: 500,
  });

  const [isPointer, setIsPointer] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;

      globalMousePosition = { x: clientX, y: clientY };

      cursorX.set(clientX);
      cursorY.set(clientY);

      const target = document.elementFromPoint(
        clientX,
        clientY,
      ) as HTMLElement | null;

      const button = target?.closest("button, a");

      if (button) {
        setIsPointer(true);
        scale.set(1.15);
      } else {
        setIsPointer(false);
        scale.set(1);
      }
    };

    document.documentElement.style.cursor = "none";
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.documentElement.style.cursor = "auto";
    };
  }, [cursorX, cursorY, scale]);

  return (
  <motion.div
    style={{
      position: "fixed",
      left: cursorX,
      top: cursorY,
      scale,
      x: -6,
      y: -4,
      pointerEvents: "none",
      zIndex: 9999,
      willChange: "transform",
    }}
  >
    {isPointer ? (
      <PointerCursorSVG />
    ) : (
      <motion.div style={{ rotate: -25 }}>
        {cursor}
      </motion.div>
    )}
  </motion.div>
);}