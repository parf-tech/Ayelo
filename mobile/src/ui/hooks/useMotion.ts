import { motion } from '../../theme';
import { useReduceMotion } from './useReduceMotion';

export type MotionName = keyof typeof motion.duration;

export type UseMotion = {
  /** Vrai si le mouvement est réduit ou si le réglage est encore inconnu (on n'anime pas avant de savoir). */
  reduced: boolean;
  /** Durée en ms du jeton `motion.duration[name]` ; 0 si le mouvement est réduit. */
  duration: (name: MotionName) => number;
};

export function useMotion(): UseMotion {
  const reduceMotion = useReduceMotion();
  const reduced = reduceMotion !== false;
  return {
    reduced,
    duration: (name) => (reduced ? 0 : motion.duration[name]),
  };
}
