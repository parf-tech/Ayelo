# design/ : source unique des jetons de design

`tokens.json` est la seule source des couleurs, de la typographie, de l'espacement, des rayons, de l'élévation, du mouvement, des z-index, du focus, des opacités d'état, des tailles d'icône et de la zone de toucher étendue. Le générateur `build-tokens.mjs` (Node ESM, aucune dépendance) en tire :

| Sortie | Fichier | Remarque |
|---|---|---|
| Application | `mobile/src/theme/tokens.ts` | Généré. Seul fichier de `mobile/` qui contient des couleurs. |
| Site web | `web/assets/tokens.css` | Généré. Lu par `web/tools/check-links.py` (contrastes). |
| Couleurs natives | `mobile/app.json` | Seules quatre valeurs sont réécrites : fond d'icône adaptative, couleur de notification, fonds de l'écran de démarrage (clair et sombre). |

Ne jamais modifier les fichiers générés à la main.

## Commandes (depuis `mobile/`)

```
npm run tokens         # valide puis écrit les fichiers générés
npm run tokens:check   # n'écrit rien ; code 1 et résumé des lignes différentes si un fichier est périmé
npm run tokens:test    # tests du générateur (node --test ../design/tokens.test.mjs)
node ../design/build-tokens.mjs --report   # rapports de contraste en Markdown, trois directions
```

La CI (`.github/workflows/mobile.yml`) lance `tokens:check` ; le test Jest `mobile/__tests__/tokensSync.test.ts` fait la même vérification.

## Changer de direction de marque

Dans `tokens.json`, changer la clé `activeDirection` (`"A"` Terre cuite, `"B"` Lagune, `"C"` Encre et safran), puis `npm run tokens`. Les couleurs, les rayons, `tokens.ts`, `tokens.css` et `app.json` suivent. Les trois directions sont validées à chaque génération, donc aucune ne peut devenir inutilisable sans que la génération échoue.

Détail, tableaux de valeurs et résultats de contraste : `docs/design/02-tokens.md`.
