// Vérifie les variables EXPO_PUBLIC_* indispensables à une version de production (revue design-1 P0-1 : pas de lien légal mort,
// pas d'application pointant vers aucun serveur). Aucune valeur n'est affichée : seulement les noms manquants.
//
// Usage :
//   npm run check:env                       profil lu dans EAS_BUILD_PROFILE (ou APP_ENV) ; hors production : avertissements seulement
//   node scripts/check-env.js --strict      applique les règles de production quel que soit le profil
// Branchement EAS : le script npm `eas-build-pre-install` (package.json) l'exécute sur le serveur de build, pour chaque profil ;
// seul le profil `production` peut échouer. Les variables viennent de l'environnement EAS rattaché au profil (eas.json, `environment`).

const REQUIRED = ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_TERMS_URL', 'EXPO_PUBLIC_PRIVACY_URL'];
const RECOMMENDED = [
  'EXPO_PUBLIC_COMMUNITY_RULES_URL',
  'EXPO_PUBLIC_SUPPORT_EMAIL',
  'EXPO_PUBLIC_REVERB_KEY',
  'EXPO_PUBLIC_REVERB_HOST',
  'EXPO_PUBLIC_REVENUECAT_IOS_KEY',
  'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY',
];

function isHttpsUrl(value) {
  return /^https:\/\/[^\s/]+\S*$/i.test(value);
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ production: boolean }} options
 * @returns {{ errors: string[]; warnings: string[] }}
 */
function checkEnv(env, options) {
  const errors = [];
  const warnings = [];
  const blank = (name) => !env[name] || String(env[name]).trim() === '';

  for (const name of REQUIRED) {
    if (blank(name)) errors.push(`${name} est absente ou vide`);
    else if (!isHttpsUrl(String(env[name]).trim())) errors.push(`${name} doit être une adresse https://`);
  }
  for (const name of RECOMMENDED) {
    if (blank(name)) warnings.push(`${name} n'est pas définie`);
  }
  return options.production ? { errors, warnings } : { errors: [], warnings: [...errors, ...warnings] };
}

function main(argv, env) {
  const profile = env.EAS_BUILD_PROFILE || env.APP_ENV || '';
  const production = argv.includes('--strict') || profile === 'production';
  const { errors, warnings } = checkEnv(env, { production });
  for (const w of warnings) console.warn(`check:env (avertissement) : ${w}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`check:env (ERREUR) : ${e}`);
    console.error('Build de production refusé : définir ces variables dans l’environnement EAS « production » (eas env:create).');
    return 1;
  }
  process.stdout.write(`check:env : OK (profil « ${profile || 'non précisé'} »${production ? ', règles de production' : ''}).\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2), process.env));
}

module.exports = { checkEnv, main, REQUIRED, RECOMMENDED };
