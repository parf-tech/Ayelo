import { Redirect } from 'expo-router';
import React from 'react';
import { ComponentsDemoScreen } from '../../src/features/demo/ComponentsDemoScreen';

/** Écran de démonstration des composants : réservé au développement ; en production la route renvoie à l'accueil. */
export default function ComponentsDemoRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <ComponentsDemoScreen />;
}
