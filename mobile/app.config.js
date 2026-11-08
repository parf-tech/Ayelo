// Prolonge app.json (Expo le charge et le passe en `config`). Ajoute seulement le fichier de configuration Firebase
// de l'app Android (FCM). Le fichier n'est JAMAIS commité (voir .gitignore) :
//  - build EAS : variable d'environnement de type « fichier » GOOGLE_SERVICES_JSON (EAS la rend sous forme de chemin) ;
//  - build local : ./google-services.json posé à la main (téléchargé depuis la console Firebase).
// Sans le fichier, l'app se construit quand même mais ne reçoit aucune notification sur Android.
const fs = require('node:fs');

module.exports = ({ config }) => {
  const fromEnv = process.env.GOOGLE_SERVICES_JSON;
  const local = './google-services.json';
  const file = fromEnv && fromEnv.length > 0 ? fromEnv : fs.existsSync(local) ? local : undefined;

  if (!file) return config;
  return { ...config, android: { ...config.android, googleServicesFile: file } };
};
