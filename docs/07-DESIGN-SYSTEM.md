# 07 : Design system (indépendant)

Palette, typographie et nom sont **provisoires** : la marque n'est pas encore définie. Ils servent de base technique et seront remplacés par ceux de `replica-brand`. Rien n'est repris de l'identité de l'original.

## Tokens

```ts
// mobile/src/theme/tokens.ts  (à créer en phase A)
export const colors = {
  light: {
    bg: '#FFFFFF', surface: '#F6F4F2', text: '#1B1A19', textMuted: '#5E5A56',
    primary: '#C2410C', onPrimary: '#FFFFFF',
    like: '#16A34A', dislike: '#DC2626', verified: '#2563EB',
    border: '#E4E0DC', danger: '#B91C1C', warning: '#B45309', success: '#15803D',
  },
  dark: {
    bg: '#121110', surface: '#1E1C1A', text: '#F3F1EE', textMuted: '#A8A29E',
    primary: '#FB923C', onPrimary: '#1B1A19',
    like: '#4ADE80', dislike: '#F87171', verified: '#60A5FA',
    border: '#3A3633', danger: '#F87171', warning: '#FBBF24', success: '#4ADE80',
  },
};
export const space = [0, 4, 8, 12, 16, 24, 32, 48];
export const radius = { sm: 8, md: 12, lg: 20, pill: 999 };
export const type = {
  title: { size: 28, weight: '700', line: 34 },
  h2: { size: 22, weight: '600', line: 28 },
  body: { size: 16, weight: '400', line: 22 },
  caption: { size: 13, weight: '400', line: 18 },
};
```

Contrastes à vérifier avant publication (outil de contraste automatisé dans la CI).

## Typographie

Police système (SF Pro / Roboto) en V1 : rapide, lisible, aucune licence. Une police de marque pourra venir ensuite.

## Composants

| composant | variantes | états | écrans |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger | default, pressed, disabled, loading | tous |
| TextField | texte, mot de passe, multiligne | default, focus, erreur, désactivé | S02, S04, S60 |
| Select / CountryPicker | liste recherchable | vide, sélectionné | S04, S07, S09 |
| ChoiceCard | intention, plan Premium | sélectionné, non sélectionné | S05, S30 |
| ProfileCard | swipe, grille, liste | normal, vérifié, chargement (squelette) | S10, S11, S24 |
| Avatar | tailles S/M/L, anneau story | présence en ligne, story non vue | S13, S14, S20 |
| MessageBubble | texte, image, vocal, appel manqué, cadeau, système | envoi, envoyé, remis, lu, échec | S14 |
| Badge | vérifié, Premium, non lu | | S10, S13 |
| Modal / BottomSheet | confirmation, menu, achat | | S11, S14, S55 |
| Toast / Banner | succès, erreur, hors ligne | | tous |
| TabBar | 3 ou 5 onglets | actif, badge | racine |
| Skeleton | carte, ligne | | S10, S13 |
| EmptyState | illustration + action | | S10, S13, S24 |
| Toggle / Slider / RangeSlider | | | S07, S09, S51 |
| CallControls | micro, caméra, haut-parleur, raccrocher | actif, coupé | S17 |

## Icônes et illustrations

Jeu d'icônes sous licence libre (Lucide). Illustrations originales à commander ou créer ; aucune image tirée de l'original ou de stocks sans licence.

## Règles

1. Aucune couleur écrite en dur dans les composants : uniquement des tokens.
2. Tout composant a une story Storybook (ou page d'exemple Expo) pour chaque état.
3. Les textes passent par `t('clé')`.
4. Les composants sont testés (Jest + Testing Library) et validés en clair et sombre.

## Livrables à produire

- `mobile/src/theme/` (tokens, thème sombre/clair).
- `mobile/src/ui/` (composants ci-dessus).
- Page de démonstration des composants.
