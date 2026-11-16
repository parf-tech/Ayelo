import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

export type StepperStep = {
  key: string;
  /** Nom court de l'étape, affiché dans la ligne de texte sous le trait (seule l'étape en cours est nommée). */
  label: string;
};

export type StepperProps = {
  steps: readonly StepperStep[];
  /** Étape en cours, de 1 à `steps.length`. Les précédentes sont terminées. */
  current: number;
  /** Texte de progression, ex. « Étape 2 sur 4 » : lu par les lecteurs d'écran et affiché, suivi du nom de l'étape. */
  label: string;
  /** Rendu sur le fond de marque (en-tête prune) : segments clairs, étape en cours en `accent`. Sinon sur fond d'écran. */
  onBrand?: boolean;
  testID?: string;
};

const SEGMENT_HEIGHT = 4;
/** Opacité du blanc des segments : terminé, à venir. Décoratif : l'état est aussi écrit (« Étape 2 sur 4 · Intention »). */
const DONE_OPACITY = 0.88;
const TODO_OPACITY = 0.24;

/**
 * Indicateur d'étapes d'un parcours séquencé : un trait fin découpé en autant de segments que d'étapes, puis une
 * ligne de texte « Étape 2 sur 4 · Intention ». Les étapes viennent de la machine d'états réelle du parcours : rien
 * n'est inventé. Une seule annonce pour le lecteur d'écran (rôle progressbar, libellé « Étape 2 sur 4 », valeur =
 * nom de l'étape) ; visuellement l'état est écrit en toutes lettres, la couleur du segment (accent pour l'étape en
 * cours) ne porte jamais l'information seule. Une seule ligne de texte : rien n'est coupé à 320 pt ni à 200 %.
 */
export function Stepper({ steps, current, label, onBrand = false, testID }: StepperProps) {
  const { colors, space } = useTheme();
  const total = steps.length;
  const index = Math.min(total, Math.max(1, current));
  const currentStep = steps[index - 1];

  const segment = (n: number) => {
    if (onBrand) {
      if (n === index) return { backgroundColor: colors.accent, opacity: 1 };
      return { backgroundColor: colors.onBrand, opacity: n < index ? DONE_OPACITY : TODO_OPACITY };
    }
    if (n === index) return { backgroundColor: colors.primary, opacity: 1 };
    return n < index ? { backgroundColor: colors.textMuted, opacity: 1 } : { backgroundColor: colors.border, opacity: 1 };
  };

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 1, max: total, now: index, text: currentStep?.label }}
      style={{ gap: space[2] }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', gap: space[2] }}
      >
        {steps.map((step, i) => (
          <View
            key={step.key}
            testID={testID ? `${testID}-segment-${i + 1}` : undefined}
            style={{ flex: 1, height: SEGMENT_HEIGHT, borderRadius: SEGMENT_HEIGHT / 2, ...segment(i + 1) }}
          />
        ))}
      </View>
      <Text
        variant="captionMedium"
        tone={onBrand ? 'onBrand' : 'textMuted'}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {currentStep ? `${label} · ${currentStep.label}` : label}
      </Text>
    </View>
  );
}
