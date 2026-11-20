import { screen } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { type } from '../src/theme/tokens';
import { CheckboxField, ChoiceCard, ListRow, NavRow, SwitchRow, TextField } from '../src/ui';
import { flatStyle, renderThemed } from './helpers/render';

/**
 * Revue design P1-7 : `caption` fait 13 pt. Tout contenu critique (consentements, erreurs, aide à la saisie, prix, état,
 * sécurité, texte légal) passe à `bodySmall` (14 pt) ; seules les métadonnées (heures, compteurs, pastilles, étiquettes
 * de navigation) gardent la légende.
 */

// Éléments masqués inclus : certaines lignes (bascule) n'exposent au lecteur d'écran que leur contrôle.
const size = (text: string) => Number(flatStyle(screen.getByText(text, { includeHiddenElements: true }).props.style).fontSize);
const noop = () => undefined;

describe('composants partagés : le texte qui informe fait au moins 14 pt', () => {
  it('champ de saisie : message d’erreur et aide', async () => {
    await renderThemed(<TextField label="E-mail" value="" onChangeText={noop} error="Adresse invalide" />);
    expect(size('Adresse invalide')).toBeGreaterThanOrEqual(14);
    await screen.unmount();
    await renderThemed(<TextField label="E-mail" value="" onChangeText={noop} helper="Nous ne l’affichons jamais" />);
    expect(size('Nous ne l’affichons jamais')).toBeGreaterThanOrEqual(14);
  });

  it('case à cocher (consentement) : description et pastille « Obligatoire »', async () => {
    await renderThemed(<CheckboxField label="CGU" description="J’ai lu les conditions" badge="Obligatoire" checked={false} onChange={noop} />);
    expect(size('J’ai lu les conditions')).toBeGreaterThanOrEqual(14);
    expect(size('Obligatoire')).toBeGreaterThanOrEqual(14);
  });

  it('bascule : description (confidentialité)', async () => {
    await renderThemed(<SwitchRow label="Profil visible" description="Désactivé, personne ne peut vous voir" value onValueChange={noop} />);
    expect(size('Désactivé, personne ne peut vous voir')).toBeGreaterThanOrEqual(14);
  });

  it('ligne de liste : description et valeur (prix, état)', async () => {
    await renderThemed(<ListRow label="Abonnement" description="12 novembre 2026, Confirmé" value="24,99 €" />);
    expect(size('12 novembre 2026, Confirmé')).toBeGreaterThanOrEqual(14);
    expect(size('24,99 €')).toBeGreaterThanOrEqual(14);
  });

  it('ligne de navigation : description et valeur', async () => {
    await renderThemed(<NavRow label="Langue" description="Langue de l’application" value="Français" onPress={noop} />);
    expect(size('Langue de l’application')).toBeGreaterThanOrEqual(14);
    expect(size('Français')).toBeGreaterThanOrEqual(14);
  });

  it('carte de choix : description', async () => {
    await renderThemed(<ChoiceCard label="Relation sérieuse" description="Je cherche une relation durable" selected={false} onPress={noop} />);
    expect(size('Je cherche une relation durable')).toBeGreaterThanOrEqual(14);
  });

  it('le décalage de l’icône d’erreur suit la hauteur de ligne du texte d’erreur (14 pt)', async () => {
    await renderThemed(<TextField label="E-mail" value="" onChangeText={noop} error="Adresse invalide" testID="mail" />);
    const text = screen.getByTestId('mail-error');
    expect(flatStyle(text.props.style).lineHeight).toBe(type.bodySmall.line);
  });
});

/**
 * Garde-fou : chaque usage restant de la légende (`caption`, `captionStrong`, `captionMedium`) est une métadonnée choisie.
 * Un usage ajouté ou retiré fait échouer ce test : décider si le texte est critique (alors `bodySmall`) ou une métadonnée
 * (alors mettre à jour cette liste, avec la raison).
 */
const METADATA_CAPTION_USES: Record<string, number> = {
  'src/features/auth/AuthFormScreen.tsx': 1, // invite « Pas de compte ? » à côté de son lien
  'src/features/calls/CallScreen.tsx': 1, // type d'appel sur le fond de marque
  'src/features/demo/ComponentsDemoScreen.tsx': 2, // écran de démonstration, hors produit
  'src/features/discover/ProfileDetailScreen.tsx': 2, // compteur de photos, étiquette d'intention
  'src/features/discover/SwipeCard.tsx': 2, // pastilles sur la carte (taille plafonnée)
  'src/features/messages/ConversationScreen.tsx': 2, // appel manqué, « écrit… »
  'src/features/messages/DateSeparator.tsx': 1, // séparateur de jour
  'src/features/messages/MessageBubble.tsx': 2, // heure, état d'envoi courant (l'échec est en bodySmallStrong)
  'src/features/messages/MessagesListScreen.tsx': 2, // heure, pastille de non lus
  'src/features/onboarding/CountryPicker.tsx': 2, // compteur « et N autres », aucune sélection
  'src/features/onboarding/FormSection.tsx': 1, // « facultatif »
  'src/features/photos/PhotosManager.tsx': 1, // compteur de photos
  'src/features/profile/ProfileTabScreen.tsx': 1, // pastille Premium
  'src/features/settings/SettingsScreen.tsx': 2, // titre de section, version
  'src/features/welcome/WelcomeBenefits.tsx': 1, // avantages sur le fond de marque
  'src/navigation/MainTabs.tsx': 2, // libellés d'onglets
  'src/ui/IconButton.tsx': 1, // pastille de compteur
  'src/ui/Stepper.tsx': 1, // « Étape 2 sur 5 »
  'src/ui/VerifiedBadge.tsx': 2, // étiquette de badge
};

/** Fichiers qui DÉFINISSENT la légende (type de variante, jetons) : pas des usages. */
const DEFINITIONS = new Set(['src/ui/Text.tsx', 'src/theme/tokens.ts']);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('légende (caption) : métadonnées seulement', () => {
  it('chaque usage restant est dans la liste des métadonnées', async () => {
    const root = path.resolve(__dirname, '..');
    const found: Record<string, number> = {};
    for (const file of [...sourceFiles(path.join(root, 'src')), ...sourceFiles(path.join(root, 'app'))]) {
      const rel = path.relative(root, file).split(path.sep).join('/');
      if (DEFINITIONS.has(rel)) continue;
      const count = (fs.readFileSync(file, 'utf8').match(/(['"])caption(?:Strong|Medium)?\1/g) ?? []).length;
      if (count > 0) found[rel] = count;
    }
    expect(found).toEqual(METADATA_CAPTION_USES);
  });
});
