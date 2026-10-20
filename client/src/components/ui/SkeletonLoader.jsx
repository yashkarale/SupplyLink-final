import { motion, useReducedMotion } from "framer-motion";

const skeletonVariants = {
  initial: { opacity: 0.5 },
  animate: {
    opacity: [0.5, 0.85, 0.5],
    transition: {
      duration: 1.2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
  reduced: { opacity: 0.7 },
};

function SkeletonBase({
  width = "100%",
  height = 16,
  radius = "rounded-lg",
  className = "",
  theme = "light",
  style = {},
}) {
  const shouldReduceMotion = useReducedMotion();
  const isDark = theme === "dark";

  return (
    <motion.div
      aria-hidden="true"
      initial="initial"
      animate={shouldReduceMotion ? "reduced" : "animate"}
      variants={skeletonVariants}
      className={[
        "shrink-0",
        radius,
        isDark ? "bg-[var(--surface-raised)]" : "bg-[var(--line)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        width,
        height,
        ...style,
      }}
    />
  );
}

export default function SkeletonLoader({
  className = "",
  width = "100%",
  height = 16,
  theme = "light",
  radius = "rounded-lg",
  style = {},
}) {
  return (
    <SkeletonBase
      width={width}
      height={height}
      radius={radius}
      className={className}
      theme={theme}
      style={style}
    />
  );
}

export function SkeletonLine({
  width = "100%",
  height = 14,
  className = "",
  theme = "light",
}) {
  return (
    <SkeletonBase
      width={width}
      height={height}
      radius="rounded"
      className={className}
      theme={theme}
    />
  );
}

export function SkeletonText({
  lines = 3,
  lastLineWidth = "65%",
  lineHeight = 14,
  gap = 10,
  theme = "light",
  className = "",
}) {
  return (
    <div
      className={["flex flex-col", className].filter(Boolean).join(" ")}
      style={{ gap }}
      aria-hidden="true"
    >
      {Array.from({ length: Math.max(0, lines) }, (_, index) => (
        <SkeletonLine
          key={index}
          height={lineHeight}
          width={index === lines - 1 ? lastLineWidth : "100%"}
          theme={theme}
        />
      ))}
    </div>
  );
}
