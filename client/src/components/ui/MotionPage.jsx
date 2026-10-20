
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation } from "react-router-dom";

const pageVariants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -6,
  },
};

const pageTransition = {
  duration: 0.22,
  ease: "easeOut",
};

export function MotionPage({ children }) {
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  const variants = reduceMotion
    ? {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
      }
    : pageVariants;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{
          ...pageTransition,
          duration: reduceMotion ? 0 : pageTransition.duration,
        }}
        className="w-full min-w-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export default MotionPage;
