#!/usr/bin/env python3
"""Génère les pages HTML statiques de web/ (français à la racine, anglais sous en/).

Le résultat est du HTML simple, versionné tel quel : ce script ne sert qu'à garder les deux langues synchrones.
Utilisation : python web/tools/build.py [--api-base https://api.exemple]   (aucune dépendance hors bibliothèque standard).

Dans les textes : {{xxx}} devient un marqueur visible [À COMPLÉTER : xxx] ; href="page:clé" devient le chemin relatif de la page.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Valeurs de backend/config/retention.php (RETENTION_REPORT_DETAILS_DAYS, RETENTION_SANCTION_REASON_DAYS) et
# AccountDeletion::GRACE_DAYS. À resynchroniser si le backend change.
GRACE_DAYS = 30

# Origine publique de l'API (domaine {$API_DOMAIN} de Caddy). Tant que c'est un hôte .invalid, les formulaires de suppression
# affichent « non relié au service ». Production : python web/tools/build.py --api-base https://<API_DOMAIN>
API_BASE = 'https://api.example.invalid'
REPORT_DAYS = 365
SANCTION_DAYS = 365

# Chemins (relatifs à la racine d'une langue). La clé sert aux liens `page:clé`.
PATHS = {
    'index': 'index.html',
    'terms': 'legal/terms.html',
    'privacy': 'legal/privacy.html',
    'community': 'legal/community.html',
    'safety': 'safety.html',
    'support': 'support.html',
    'delete': 'account/delete.html',
    'confirm': 'confirm-deletion.html',
}
NAV = ['index', 'terms', 'privacy', 'community', 'safety', 'support', 'delete']  # menu mobile : tout le site
NAV_BAR = ['terms', 'privacy', 'community', 'safety', 'support']  # barre d'en-tête (le logo ramène à l'accueil)
NAV_FOOT = ['delete']  # ce que la barre ne porte pas

UI = {
    'fr': {
        'skip': 'Aller au contenu',
        'brand': 'Ayelo',
        'menu': 'Menu',
        'banner': '<strong>Version provisoire, à valider par un juriste.</strong> Ce texte est un brouillon technique, il n’est pas un avis juridique et ne doit pas être considéré comme définitif. Les mentions <mark class="todo">[À COMPLÉTER]</mark> sont des champs que le propriétaire du service doit renseigner.',
        'nav': {'index': 'Accueil', 'terms': 'Conditions d’utilisation', 'privacy': 'Confidentialité',
                'community': 'Règles de la communauté', 'safety': 'Sécurité et signalement', 'support': 'Support',
                'delete': 'Supprimer mon compte'},
        'switch': 'English',
        'switch_label': 'Read this page in English',
        'todo': '[À COMPLÉTER : %s]',
        'footer': 'Version provisoire du site, brouillon 0.1 (2026-11-07). Aucun suivi, aucune statistique, aucune ressource externe.',
        'dir': 'Pages du site',
    },
    'en': {
        'skip': 'Skip to content',
        'brand': 'Ayelo',
        'menu': 'Menu',
        'banner': '<strong>Provisional version, to be validated by a lawyer.</strong> This text is a technical draft, it is not legal advice and must not be treated as final. <mark class="todo">[TO BE COMPLETED]</mark> marks are fields the service owner must fill in. The French text is the reference draft.',
        'nav': {'index': 'Home', 'terms': 'Terms of use', 'privacy': 'Privacy',
                'community': 'Community rules', 'safety': 'Safety and reporting', 'support': 'Support',
                'delete': 'Delete my account'},
        'switch': 'Français',
        'switch_label': 'Lire cette page en français',
        'todo': '[TO BE COMPLETED: %s]',
        'footer': 'Provisional site version, draft 0.1 (2026-11-07). No tracking, no analytics, no external resource.',
        'dir': 'Site pages',
    },
}

# ---------------------------------------------------------------------------------------------------------------------
# Contenu : PAGES[clé][langue] = (titre, description, corps HTML)
# ---------------------------------------------------------------------------------------------------------------------
PAGES = {}

# ----- Accueil -----
PAGES['index'] = {
    'fr': ('Accueil', 'Ayelo, application de rencontres pour personnes majeures : règles de la communauté, sécurité, support et suppression de compte.', f"""
<section class="hero">
<div class="hero-text">
<h1>Rencontrez, échangez, aimez</h1>
<p class="lead">Ayelo est une application de rencontres pour personnes majeures : se rencontrer, échanger et s’appeler. Ce site rassemble les informations publiques du service.</p>
<p class="get">Télécharger l’application : {{{{liens App Store et Google Play}}}}</p>
</div>
<div class="hero-mark" aria-hidden="true"><img class="mark" src="@@BRAND@@/ayelo-symbole.svg" alt="" width="112" height="100"><span class="wordmark">Ayelo</span></div>
</section>
<h2>Informations essentielles</h2>
<ul class="rows">
  <li><a href="page:terms"><strong>Conditions d’utilisation</strong><span>Ce que vous pouvez attendre du service, et ce que nous attendons de vous</span></a></li>
  <li><a href="page:privacy"><strong>Politique de confidentialité</strong><span>Les données que nous traitons, pourquoi, et combien de temps</span></a></li>
  <li><a href="page:community"><strong>Règles de la communauté</strong><span>Respect, consentement, zéro arnaque</span></a></li>
  <li><a href="page:safety"><strong>Sécurité et signalement</strong><span>Bloquer, signaler, se protéger lors d’une rencontre</span></a></li>
  <li><a href="page:support"><strong>Support et contact</strong><span>Une question, un problème, une demande liée à vos données</span></a></li>
  <li><a href="page:delete"><strong>Supprimer mon compte</strong><span>Dans l’application ou depuis cette page, délai de {GRACE_DAYS} jours</span></a></li>
</ul>
<div class="callout notice"><span class="figure" aria-hidden="true">18+</span><p>Le service est réservé aux personnes de <strong>18 ans et plus</strong>. Nous ne vérifions pas l’identité des membres : voir « Sécurité et signalement ».</p></div>
<p class="small">Éditeur du service : {{{{dénomination de la société, adresse, numéro d’immatriculation}}}}. Directeur de la publication : {{{{nom}}}}. Hébergeur du site : {{{{nom et adresse de l’hébergeur}}}}.</p>
"""),
    'en': ('Home', 'Ayelo, a dating application for adults: community rules, safety, support and account deletion.', f"""
<section class="hero">
<div class="hero-text">
<h1>Meet, chat, love</h1>
<p class="lead">Ayelo is a dating application for adults: meet people, chat and call. This site gathers the public information about the service.</p>
<p class="get">Download the application: {{{{App Store and Google Play links}}}}</p>
</div>
<div class="hero-mark" aria-hidden="true"><img class="mark" src="@@BRAND@@/ayelo-symbole.svg" alt="" width="112" height="100"><span class="wordmark">Ayelo</span></div>
</section>
<h2>Key information</h2>
<ul class="rows">
  <li><a href="page:terms"><strong>Terms of use</strong><span>What you can expect from the service, and what we expect from you</span></a></li>
  <li><a href="page:privacy"><strong>Privacy policy</strong><span>The data we process, why, and for how long</span></a></li>
  <li><a href="page:community"><strong>Community rules</strong><span>Respect, consent, zero scams</span></a></li>
  <li><a href="page:safety"><strong>Safety and reporting</strong><span>Block, report, stay safe when you meet someone</span></a></li>
  <li><a href="page:support"><strong>Support and contact</strong><span>A question, a problem, a request about your data</span></a></li>
  <li><a href="page:delete"><strong>Delete my account</strong><span>In the app or from this page, {GRACE_DAYS}-day delay</span></a></li>
</ul>
<div class="callout notice"><span class="figure" aria-hidden="true">18+</span><p>The service is reserved for people aged <strong>18 and over</strong>. We do not verify the identity of members: see “Safety and reporting”.</p></div>
<p class="small">Service publisher: {{{{company name, address, registration number}}}}. Publication director: {{{{name}}}}. Site host: {{{{host name and address}}}}.</p>
"""),
}

# ----- Conditions d'utilisation -----
PAGES['terms'] = {
    'fr': ('Conditions d’utilisation', 'Conditions générales d’utilisation du service (version provisoire).', f"""
<h1>Conditions d’utilisation</h1>
<p class="lead">Brouillon 0.1, non validé juridiquement. Dernière mise à jour du brouillon : 2026-11-06.</p>

<h2>1. Qui sommes-nous</h2>
<p>{{{{dénomination de la société, forme, capital, siège, numéro d’immatriculation, directeur de la publication, hébergeur, adresse de contact}}}}</p>

<h2>2. Objet</h2>
<p>L’application <mark class="todo">[Nom]</mark> permet à des personnes majeures de se rencontrer, d’échanger et d’appeler. Elle est gratuite à l’installation ; certaines fonctions sont payantes (abonnement Premium, crédits).</p>

<h2>3. Conditions d’accès</h2>
<ul>
  <li>Vous devez avoir <strong>au moins 18 ans</strong>, et l’âge de la majorité de votre pays si elle est plus élevée.</li>
  <li>Vous devez fournir des informations exactes, choisir un mot de passe fort et ne pas le partager.</li>
  <li>Un compte est personnel. Nous pouvons refuser, suspendre ou supprimer un compte qui enfreint les présentes conditions ou la loi.</li>
</ul>
<p>L’âge est contrôlé avant la création du compte par simple déclaration. Aucune pièce d’identité n’est demandée.</p>

<h2>4. Votre contenu</h2>
<p>Vous restez propriétaire de vos contenus (profil, photos, messages). Vous nous accordez une licence non exclusive, limitée à l’exploitation du service (hébergement, affichage, modération). Vos contenus ne doivent pas violer la loi ni les droits d’autrui. Vos photos sont examinées avant d’être visibles par les autres.</p>

<h2>5. Comportements interdits</h2>
<p>Se faire passer pour quelqu’un d’autre ; harceler, menacer ; demander ou proposer de l’argent ou des cadeaux à une personne rencontrée sur le service ; publier un contenu illicite, haineux ou sexuellement explicite non consenti ; tout contenu impliquant des mineurs (tolérance zéro, signalement aux autorités) ; spam, automatisation, collecte de données ; vente de comptes. Voir les <a href="page:community">règles de la communauté</a>.</p>

<h2>6. Sécurité des rencontres</h2>
<p>Nous ne vérifions pas l’identité des membres. Un badge « vérifié » signifie qu’une revue de photo a été faite, pas une garantie d’identité. Ne versez jamais d’argent à une personne rencontrée en ligne. Signalez tout comportement suspect depuis l’application. Voir <a href="page:safety">sécurité et signalement</a>.</p>

<h2>7. Abonnements et achats</h2>
<p>Les achats passent par l’App Store ou Google Play. L’abonnement se renouvelle automatiquement jusqu’à annulation dans les réglages du store ; <strong>supprimer l’application ou le compte n’annule pas l’abonnement</strong>. Remboursements : selon les règles du store.</p>
<p>{{{{prix, durées, renouvellement, droit de rétractation selon le pays : à rédiger par un juriste}}}}</p>

<h2>8. Suppression du compte</h2>
<p>Vous pouvez supprimer votre compte dans l’application ou <a href="page:delete">depuis cette page web</a>. Votre profil est masqué immédiatement ; vos données personnelles sont anonymisées après {GRACE_DAYS} jours, hors celles que la loi ou la sécurité nous obligent à conserver (signalements, sanctions).</p>

<h2>9. Modération et contestation</h2>
<p>Nous examinons les signalements. Une sanction vous est notifiée avec son motif ; vous pouvez la contester une fois.</p>

<h2>10. Responsabilité</h2>
<p>{{{{limitation de responsabilité, garanties légales, force majeure : juriste}}}}</p>

<h2>11. Droit applicable et litiges</h2>
<p>{{{{droit applicable, juridiction, médiation, spécificités consommateurs par pays : juriste}}}}</p>

<h2>12. Modification</h2>
<p>{{{{modalités de modification et de notification des conditions}}}}</p>
"""),
    'en': ('Terms of use', 'General terms of use of the service (provisional version).', f"""
<h1>Terms of use</h1>
<p class="lead">Draft 0.1, not legally validated. Draft last updated: 2026-11-06. This English text is a working translation of the French draft.</p>

<h2>1. Who we are</h2>
<p>{{{{company name, legal form, capital, registered office, registration number, publication director, host, contact address}}}}</p>

<h2>2. Purpose</h2>
<p>The <mark class="todo">[Name]</mark> application lets adults meet, chat and call each other. It is free to install; some features are paid (Premium subscription, credits).</p>

<h2>3. Access conditions</h2>
<ul>
  <li>You must be <strong>at least 18 years old</strong>, and of the age of majority in your country if it is higher.</li>
  <li>You must provide accurate information, choose a strong password and not share it.</li>
  <li>An account is personal. We may refuse, suspend or delete an account that breaches these terms or the law.</li>
</ul>
<p>Age is checked before the account is created, by declaration only. No identity document is requested.</p>

<h2>4. Your content</h2>
<p>You remain the owner of your content (profile, photos, messages). You grant us a non-exclusive licence limited to operating the service (hosting, display, moderation). Your content must not break the law or the rights of others. Your photos are reviewed before other members can see them.</p>

<h2>5. Prohibited behaviour</h2>
<p>Impersonating someone; harassing or threatening; asking for or offering money or gifts to a person met on the service; posting unlawful or hateful content, or sexually explicit content without consent; any content involving minors (zero tolerance, reported to the authorities); spam, automation, data harvesting; selling accounts. See the <a href="page:community">community rules</a>.</p>

<h2>6. Safety when meeting</h2>
<p>We do not verify the identity of members. A “verified” badge means a photo review was done, not a guarantee of identity. Never send money to someone you met online. Report any suspicious behaviour from the application. See <a href="page:safety">safety and reporting</a>.</p>

<h2>7. Subscriptions and purchases</h2>
<p>Purchases go through the App Store or Google Play. The subscription renews automatically until you cancel it in your store settings; <strong>deleting the application or the account does not cancel the subscription</strong>. Refunds follow the store rules.</p>
<p>{{{{prices, durations, renewal, withdrawal right by country: to be drafted by a lawyer}}}}</p>

<h2>8. Account deletion</h2>
<p>You can delete your account in the application or <a href="page:delete">from this web page</a>. Your profile is hidden immediately; your personal data is anonymised after {GRACE_DAYS} days, except what the law or security requires us to keep (reports, sanctions).</p>

<h2>9. Moderation and appeals</h2>
<p>We review reports. A sanction is notified to you with its reason; you can appeal it once.</p>

<h2>10. Liability</h2>
<p>{{{{limitation of liability, legal warranties, force majeure: lawyer}}}}</p>

<h2>11. Governing law and disputes</h2>
<p>{{{{governing law, jurisdiction, mediation, consumer specifics by country: lawyer}}}}</p>

<h2>12. Changes</h2>
<p>{{{{how the terms are changed and how members are notified}}}}</p>
"""),
}

# ----- Politique de confidentialité -----
PAGES['privacy'] = {
    'fr': ('Politique de confidentialité', 'Données traitées, finalités, durées de conservation, destinataires et droits (version provisoire).', f"""
<h1>Politique de confidentialité</h1>
<p class="lead">Brouillon 0.2, non validé juridiquement. Les durées indiquées sont celles du fonctionnement actuel du service ; ce ne sont pas des choix juridiques validés et elles peuvent changer avant la publication.</p>

<h2>1. Responsable du traitement</h2>
<p>{{{{identité, adresse, délégué à la protection des données, représentant dans l’UE ou au Royaume-Uni si nécessaire}}}}. Contact pour vos données : {{{{privacy@example.invalid}}}}</p>

<h2>2. Données que nous traitons et pourquoi</h2>
<div class="table-wrap"><table>
<thead><tr><th scope="col">Donnée</th><th scope="col">Finalité</th><th scope="col">Base légale (à valider)</th><th scope="col">Conservation actuelle</th></tr></thead>
<tbody>
<tr><td>E-mail, mot de passe (haché), date de naissance</td><td>Créer et sécuriser le compte, vérifier l’âge</td><td>Contrat, obligation légale</td><td>Jusqu’à l’anonymisation ({GRACE_DAYS} jours après la demande de suppression). À l’anonymisation, la date de naissance est <strong>réduite à l’année</strong>, elle n’est pas effacée {{{{à valider par un juriste}}}}</td></tr>
<tr><td>Nom d’affichage, genre, genre recherché, pays d’origine et de résidence, ville, intention, présentation</td><td>Profil et mise en relation</td><td>Contrat ; <strong>consentement explicite</strong> pour les données sensibles</td><td>Idem</td></tr>
<tr><td>Photos</td><td>Profil, après examen</td><td>Contrat</td><td>Supprimées à l’anonymisation</td></tr>
<tr><td>Messages</td><td>Échanges entre membres</td><td>Contrat</td><td>Contenu effacé à l’anonymisation du compte de l’expéditeur</td></tr>
<tr><td>Selfie de vérification</td><td>Vérifier le profil</td><td><strong>Consentement explicite</strong></td><td>Supprimé dès la décision de vérification</td></tr>
<tr><td>Signalements, sanctions, journal d’audit</td><td>Sécurité, modération, obligations légales</td><td>Intérêt légitime, obligation légale</td><td>Texte libre d’un signalement : {REPORT_DAYS} jours puis effacé, une fois le compte d’une des parties anonymisé (sauf conservation probatoire). Motif d’une sanction : {SANCTION_DAYS} jours puis remplacé par un marqueur, une fois le compte sanctionné anonymisé. Empreinte (hash) de l’e-mail d’un compte sanctionné : {{{{durée à fixer}}}}</td></tr>
<tr><td>Appareil (empreinte), adresse IP</td><td>Limites de débit, sécurité, mémoire d’un refus d’âge</td><td>Intérêt légitime</td><td>IP non conservée durablement, sauf refus d’âge : <strong>30 minutes</strong>. Appareil, e-mail (empreinte chiffrée) et identifiant de connexion sociale d’un refus d’âge : <strong>90 jours</strong></td></tr>
<tr><td>Jeton de notification (appareil), plateforme</td><td>Envoyer des notifications</td><td>Contrat ou consentement {{{{à valider}}}}</td><td>Jusqu’à la déconnexion, la suppression du compte ou l’invalidité du jeton</td></tr>
<tr><td>Archive d’export de vos données</td><td>Vous remettre une copie de vos données</td><td>Obligation légale (droit d’accès)</td><td><strong>7 jours</strong>, puis suppression</td></tr>
<tr><td>Codes à usage unique (vérification d’e-mail, réinitialisation, confirmation de suppression)</td><td>Sécuriser le compte</td><td>Contrat</td><td>24 h (vérification), 60 min (réinitialisation et confirmation de suppression)</td></tr>
<tr><td>Envois de médias non finalisés ou orphelins</td><td>Hygiène du stockage</td><td>Intérêt légitime</td><td>24 h (non finalisés), 48 h (objets sans ligne en base)</td></tr>
<tr><td>Journaux techniques du serveur</td><td>Exploitation, sécurité</td><td>Intérêt légitime</td><td>{{{{durée et contenu à définir}}}}</td></tr>
<tr><td>Achats</td><td>Accès Premium, comptabilité</td><td>Contrat, obligation légale</td><td>{{{{durée comptable : juriste}}}}</td></tr>
</tbody></table></div>
<p class="small">Aucun outil d’analyse d’usage ni de suivi publicitaire n’est intégré à l’application ni à ce site.</p>

<h2>3. Données sensibles</h2>
<p>Le genre et le genre recherché peuvent révéler une orientation sexuelle ; l’origine peut révéler une origine ethnique ; l’usage d’un service de rencontres peut révéler la vie sentimentale. Nous les traitons <strong>uniquement avec votre consentement explicite</strong>, que vous pouvez retirer (le profil est alors masqué).</p>

<h2>4. Destinataires et sous-traitants</h2>
<p>Les autres membres voient votre profil public (nom d’affichage, âge, pays, ville, présentation, intention, photos approuvées, badge).</p>
<div class="callout warn"><p><strong>À valider par un juriste.</strong> Le tableau décrit les prestataires <em>prévus</em> par le code du service. Aucun contrat ni accord de traitement n’est encore conclu et plusieurs flux n’ont pas été testés avec un vrai prestataire. Il n’affirme aucune conformité.</p></div>
<div class="table-wrap"><table>
<thead><tr><th scope="col">Prestataire</th><th scope="col">Rôle</th><th scope="col">Données concernées</th></tr></thead>
<tbody>
<tr><td>Hébergeur du serveur {{{{nom, lieu}}}}</td><td>Exécute l’application serveur, la base de données, les journaux et les sauvegardes</td><td>Toutes les données du service, y compris les messages (stockés en clair, voir ci-dessous)</td></tr>
<tr><td>Cloudflare R2</td><td>Stockage des photos, selfies de vérification, archives d’export</td><td>Fichiers image (métadonnées EXIF retirées), archives d’export de {7} jours</td></tr>
<tr><td>RevenueCat, Apple App Store, Google Play</td><td>Achats et abonnement Premium</td><td>Identifiant interne d’utilisateur (pas l’e-mail), reçus d’achat ; les moyens de paiement restent chez les stores</td></tr>
<tr><td>Firebase Cloud Messaging (Google), service de notifications d’Apple</td><td>Notifications</td><td>Jeton d’appareil. <strong>Contenu de la notification : pour un message, les 80 premiers caractères du texte ; pour un appel, le nom d’affichage de l’appelant</strong></td></tr>
<tr><td>LiveKit Cloud</td><td>Appels audio et vidéo</td><td>Identifiant, nom d’affichage, salle. <strong>Les flux audio et vidéo des appels passent par ses serveurs</strong></td></tr>
<tr><td>Fournisseur d’e-mail {{{{à choisir}}}}</td><td>E-mails de vérification, de réinitialisation et de confirmation de suppression</td><td>Adresse e-mail, langue, lien à usage unique</td></tr>
<tr><td>Google et Apple (connexion sociale)</td><td>Connexion avec Google ou Apple</td><td>Identifiant du compte social et e-mail reçus ; aucune donnée de l’utilisateur envoyée</td></tr>
<tr><td>Prestataire de modération {{{{éventuel, non choisi}}}}</td><td>Aide à la modération</td><td>{{{{à définir}}}}</td></tr>
</tbody></table></div>
<p>Les temps réels (messages, appels entrants) passent par un serveur auto-hébergé, sans tiers. Certains prestataires peuvent traiter des données hors de l’Union européenne : {{{{mécanismes de transfert, garanties, accords de traitement : juriste}}}}.</p>
<p><strong>Important :</strong> les messages ne sont <strong>pas chiffrés de bout en bout</strong>. Ils sont protégés en transit et par des contrôles d’accès, mais stockés en clair sur le serveur.</p>

<h2>5. Vos droits</h2>
<p>Accès et export (dans l’application, une demande par jour), rectification, suppression (dans l’application ou <a href="page:delete">sur cette page web</a>), opposition, limitation, retrait du consentement, réclamation auprès de l’autorité de contrôle. Contact : {{{{privacy@example.invalid}}}}</p>

<h2>6. Mineurs</h2>
<p>Le service est réservé aux personnes de 18 ans et plus. Un compte soupçonné d’appartenir à un mineur est suspendu et examiné.</p>

<h2>7. Sécurité</h2>
<p>Communications chiffrées en transit, mots de passe hachés, accès restreints, journalisation des actions d’administration. Aucune mesure n’est infaillible.</p>

<h2>8. Sauvegardes</h2>
<p>Des sauvegardes du serveur sont conservées {{{{durée finale à valider : aujourd’hui 14 jours par défaut}}}}. Une donnée supprimée peut y subsister jusqu’à leur rotation, sans être restaurée en production. {{{{niveau de chiffrement des sauvegardes à confirmer avant publication}}}}</p>
"""),
    'en': ('Privacy policy', 'Data processed, purposes, retention periods, recipients and rights (provisional version).', f"""
<h1>Privacy policy</h1>
<p class="lead">Draft 0.2, not legally validated. The periods shown are those of the service as it currently works; they are not validated legal choices and may change before publication. This English text is a working translation of the French draft.</p>

<h2>1. Data controller</h2>
<p>{{{{identity, address, data protection officer, EU or UK representative if needed}}}}. Contact for your data: {{{{privacy@example.invalid}}}}</p>

<h2>2. Data we process and why</h2>
<div class="table-wrap"><table>
<thead><tr><th scope="col">Data</th><th scope="col">Purpose</th><th scope="col">Legal basis (to be validated)</th><th scope="col">Current retention</th></tr></thead>
<tbody>
<tr><td>E-mail, password (hashed), date of birth</td><td>Create and secure the account, check age</td><td>Contract, legal obligation</td><td>Until anonymisation ({GRACE_DAYS} days after the deletion request). At anonymisation the date of birth is <strong>reduced to the year</strong>, it is not erased {{{{to be validated by a lawyer}}}}</td></tr>
<tr><td>Display name, gender, gender sought, country of origin and residence, city, intent, bio</td><td>Profile and matching</td><td>Contract; <strong>explicit consent</strong> for sensitive data</td><td>Same</td></tr>
<tr><td>Photos</td><td>Profile, after review</td><td>Contract</td><td>Deleted at anonymisation</td></tr>
<tr><td>Messages</td><td>Exchanges between members</td><td>Contract</td><td>Content erased when the sender’s account is anonymised</td></tr>
<tr><td>Verification selfie</td><td>Verify the profile</td><td><strong>Explicit consent</strong></td><td>Deleted as soon as the verification decision is made</td></tr>
<tr><td>Reports, sanctions, audit log</td><td>Safety, moderation, legal obligations</td><td>Legitimate interest, legal obligation</td><td>Free text of a report: {REPORT_DAYS} days, then erased once the account of one of the parties is anonymised (unless kept as evidence). Reason for a sanction: {SANCTION_DAYS} days, then replaced by a marker once the sanctioned account is anonymised. Hash of the e-mail of a sanctioned account: {{{{period to be set}}}}</td></tr>
<tr><td>Device (fingerprint), IP address</td><td>Rate limiting, security, memory of an age refusal</td><td>Legitimate interest</td><td>IP not kept long term, except after an age refusal: <strong>30 minutes</strong>. Device, e-mail (keyed hash) and social login identifier after an age refusal: <strong>90 days</strong></td></tr>
<tr><td>Notification token (device), platform</td><td>Send notifications</td><td>Contract or consent {{{{to be validated}}}}</td><td>Until sign-out, account deletion or the token becomes invalid</td></tr>
<tr><td>Data export archive</td><td>Give you a copy of your data</td><td>Legal obligation (right of access)</td><td><strong>7 days</strong>, then deleted</td></tr>
<tr><td>One-time codes (e-mail verification, password reset, deletion confirmation)</td><td>Secure the account</td><td>Contract</td><td>24 h (verification), 60 min (reset and deletion confirmation)</td></tr>
<tr><td>Unfinished or orphan media uploads</td><td>Storage hygiene</td><td>Legitimate interest</td><td>24 h (unfinished), 48 h (objects without a database row)</td></tr>
<tr><td>Technical server logs</td><td>Operations, security</td><td>Legitimate interest</td><td>{{{{period and content to be defined}}}}</td></tr>
<tr><td>Purchases</td><td>Premium access, accounting</td><td>Contract, legal obligation</td><td>{{{{accounting period: lawyer}}}}</td></tr>
</tbody></table></div>
<p class="small">No usage analytics tool and no advertising tracker is built into the application or this site.</p>

<h2>3. Sensitive data</h2>
<p>Gender and gender sought can reveal a sexual orientation; origin can reveal an ethnic origin; using a dating service can reveal your romantic life. We process them <strong>only with your explicit consent</strong>, which you can withdraw (your profile is then hidden).</p>

<h2>4. Recipients and processors</h2>
<p>Other members see your public profile (display name, age, country, city, bio, intent, approved photos, badge).</p>
<div class="callout warn"><p><strong>To be validated by a lawyer.</strong> The table describes the providers <em>planned</em> in the service code. No contract or data processing agreement has been signed yet and several flows have not been tested with a real provider. It claims no compliance.</p></div>
<div class="table-wrap"><table>
<thead><tr><th scope="col">Provider</th><th scope="col">Role</th><th scope="col">Data concerned</th></tr></thead>
<tbody>
<tr><td>Server host {{{{name, location}}}}</td><td>Runs the server application, the database, logs and backups</td><td>All service data, including messages (stored in clear text, see below)</td></tr>
<tr><td>Cloudflare R2</td><td>Storage of photos, verification selfies, export archives</td><td>Image files (EXIF metadata removed), 7-day export archives</td></tr>
<tr><td>RevenueCat, Apple App Store, Google Play</td><td>Purchases and Premium subscription</td><td>Internal user identifier (not the e-mail), purchase receipts; payment methods stay with the stores</td></tr>
<tr><td>Firebase Cloud Messaging (Google), Apple notification service</td><td>Notifications</td><td>Device token. <strong>Notification content: for a message, the first 80 characters of the text; for a call, the caller’s display name</strong></td></tr>
<tr><td>LiveKit Cloud</td><td>Audio and video calls</td><td>Identifier, display name, room. <strong>Call audio and video streams go through its servers</strong></td></tr>
<tr><td>E-mail provider {{{{to be chosen}}}}</td><td>Verification, reset and deletion confirmation e-mails</td><td>E-mail address, language, one-time link</td></tr>
<tr><td>Google and Apple (social sign-in)</td><td>Sign in with Google or Apple</td><td>Social account identifier and e-mail received; no user data sent</td></tr>
<tr><td>Moderation provider {{{{possible, not chosen}}}}</td><td>Moderation support</td><td>{{{{to be defined}}}}</td></tr>
</tbody></table></div>
<p>Real-time features (messages, incoming calls) run on a self-hosted server, with no third party. Some providers may process data outside the European Union: {{{{transfer mechanisms, safeguards, processing agreements: lawyer}}}}.</p>
<p><strong>Important:</strong> messages are <strong>not end-to-end encrypted</strong>. They are protected in transit and by access controls, but stored in clear text on the server.</p>

<h2>5. Your rights</h2>
<p>Access and export (in the application, one request per day), rectification, deletion (in the application or <a href="page:delete">on this web page</a>), objection, restriction, withdrawal of consent, complaint to the supervisory authority. Contact: {{{{privacy@example.invalid}}}}</p>

<h2>6. Minors</h2>
<p>The service is reserved for people aged 18 and over. An account suspected of belonging to a minor is suspended and reviewed.</p>

<h2>7. Security</h2>
<p>Communications encrypted in transit, hashed passwords, restricted access, logging of administration actions. No measure is infallible.</p>

<h2>8. Backups</h2>
<p>Server backups are kept for {{{{final period to be validated: currently 14 days by default}}}}. A deleted item may remain in them until they rotate, without being restored to production. {{{{backup encryption level to be confirmed before publication}}}}</p>
"""),
}

# ----- Règles de la communauté -----
PAGES['community'] = {
    'fr': ('Règles de la communauté', 'Ce que nous attendons des membres, ce qui est interdit, et ce qui peut arriver (version provisoire).', f"""
<h1>Règles de la communauté</h1>
<p class="lead">Brouillon 0.1, non validé juridiquement. Ces règles s’appliquent à tous les membres et complètent les <a href="page:terms">conditions d’utilisation</a>.</p>

<h2>Ce que nous attendons</h2>
<ul>
  <li><strong>Soyez vous-même :</strong> vos photos doivent vous montrer, et être récentes.</li>
  <li><strong>Soyez respectueux :</strong> pas d’insultes, de menaces, de harcèlement, de discours haineux.</li>
  <li><strong>Respectez le consentement :</strong> un « non » est un « non ». Pas de contenu sexuel envoyé sans accord.</li>
  <li><strong>Protégez votre vie privée et celle des autres :</strong> ne partagez pas les coordonnées d’une personne sans son accord.</li>
</ul>

<h2>Ce qui est interdit</h2>
<ul>
  <li>Toute demande ou offre d’argent, de cadeaux, de cartes prépayées, de transferts, de cryptomonnaies ou de « frais » (arnaques sentimentales).</li>
  <li>Les faux profils, l’usurpation d’identité, les profils multiples.</li>
  <li>Tout contenu impliquant des mineurs, la traite des êtres humains, l’exploitation sexuelle, la fraude : <strong>tolérance zéro</strong>, signalement aux autorités.</li>
  <li>Le démarchage commercial, le spam, les liens vers des services payants.</li>
  <li>L’usage de robots ou la collecte de données sur le service.</li>
</ul>

<h2>Signaler, bloquer</h2>
<p>Depuis un profil, une conversation ou un appel : « Bloquer » ou « Signaler ». Motifs proposés : demande d’argent, harcèlement, comportement lors d’une rencontre, faux profil ou spam, personne qui semble mineure, autre motif. Chaque signalement est examiné. Plus de détails : <a href="page:safety">sécurité et signalement</a>.</p>

<h2>Ce qui peut se passer</h2>
<p>Avertissement, suspension temporaire, bannissement définitif, signalement aux autorités. Vous êtes informé du motif et pouvez contester une fois.</p>

<h2>Conseils pour vos rencontres</h2>
<ul>
  <li>Rencontrez-vous dans un lieu public.</li>
  <li>Prévenez un proche.</li>
  <li>Gardez les échanges dans l’application tant que vous n’avez pas confiance.</li>
  <li>Ne versez jamais d’argent.</li>
  <li>Utilisez l’appel vidéo avant de vous voir.</li>
</ul>
"""),
    'en': ('Community rules', 'What we expect from members, what is forbidden, and what can happen (provisional version).', f"""
<h1>Community rules</h1>
<p class="lead">Draft 0.1, not legally validated. These rules apply to every member and complete the <a href="page:terms">terms of use</a>. This English text is a working translation of the French draft.</p>

<h2>What we expect</h2>
<ul>
  <li><strong>Be yourself:</strong> your photos must show you, and be recent.</li>
  <li><strong>Be respectful:</strong> no insults, threats, harassment or hate speech.</li>
  <li><strong>Respect consent:</strong> “no” means “no”. No sexual content sent without agreement.</li>
  <li><strong>Protect your privacy and that of others:</strong> do not share someone’s contact details without their agreement.</li>
</ul>

<h2>What is forbidden</h2>
<ul>
  <li>Any request or offer of money, gifts, prepaid cards, transfers, cryptocurrency or “fees” (romance scams).</li>
  <li>Fake profiles, identity theft, multiple profiles.</li>
  <li>Any content involving minors, human trafficking, sexual exploitation, fraud: <strong>zero tolerance</strong>, reported to the authorities.</li>
  <li>Commercial solicitation, spam, links to paid services.</li>
  <li>Using bots or harvesting data from the service.</li>
</ul>

<h2>Report, block</h2>
<p>From a profile, a conversation or a call: “Block” or “Report”. Reasons offered: request for money, harassment, behaviour during a meeting, fake profile or spam, person who seems to be a minor, other. Every report is reviewed. More detail: <a href="page:safety">safety and reporting</a>.</p>

<h2>What can happen</h2>
<p>Warning, temporary suspension, permanent ban, report to the authorities. You are told the reason and can appeal once.</p>

<h2>Tips for meeting</h2>
<ul>
  <li>Meet in a public place.</li>
  <li>Tell someone you trust.</li>
  <li>Keep the conversation in the application until you trust the person.</li>
  <li>Never send money.</li>
  <li>Use a video call before meeting.</li>
</ul>
"""),
}

# ----- Sécurité et signalement -----
PAGES['safety'] = {
    'fr': ('Sécurité et signalement', 'Se protéger, bloquer et signaler un membre, ce qui se passe ensuite (version provisoire).', f"""
<h1>Sécurité et signalement</h1>
<p class="lead">Votre sécurité passe d’abord par quelques réflexes simples. Vous avez aussi des outils dans l’application.</p>
<div class="callout danger"><p><strong>En cas de danger immédiat,</strong> contactez les services d’urgence de votre pays avant toute autre démarche. Ce service n’est pas un service d’urgence.</p></div>

<h2>Ce que nous ne faisons pas</h2>
<p>Nous ne vérifions pas l’identité des membres. Le badge « vérifié » signifie qu’une revue de photo a été faite, <strong>pas</strong> que l’identité est garantie. L’âge est contrôlé par déclaration. Les messages ne sont pas chiffrés de bout en bout (voir la <a href="page:privacy">politique de confidentialité</a>).</p>

<h2>Se protéger</h2>
<ul>
  <li><strong>Ne versez jamais d’argent</strong> à une personne rencontrée en ligne : virement, carte prépayée, cryptomonnaie, « frais », « urgence ».</li>
  <li>Méfiez-vous des profils qui veulent quitter l’application très vite, évitent l’appel vidéo ou inventent une urgence.</li>
  <li>Ne partagez pas votre adresse, votre lieu de travail ni des documents d’identité.</li>
  <li>Pour une première rencontre : lieu public, un proche prévenu, appel vidéo avant de vous voir, transport assuré par vous.</li>
</ul>

<h2>Bloquer</h2>
<p>Depuis un profil ou une conversation, « Bloquer » coupe immédiatement tout contact. Vous retrouvez la liste dans Paramètres, « Personnes bloquées ».</p>

<h2>Signaler</h2>
<p>Depuis un profil, une conversation ou un appel, « Signaler » ouvre un court formulaire. Motifs : demande d’argent, harcèlement ou menaces, comportement inapproprié lors d’une rencontre, faux profil ou spam, personne qui semble mineure, autre motif. Vous pouvez ajouter un texte libre.</p>

<h2>Ce qui se passe après un signalement</h2>
<ol>
  <li>Un membre de l’équipe examine le signalement. Objectif de délai de traitement : {{{{délai à confirmer par le propriétaire, aucun engagement pris à ce jour}}}}.</li>
  <li>Selon la gravité : avertissement, suspension temporaire, bannissement, signalement aux autorités.</li>
  <li>Le membre sanctionné est informé du motif et peut contester une fois.</li>
  <li>Une personne soupçonnée d’être mineure est suspendue à titre préventif dans certains cas, puis son dossier est examiné en priorité.</li>
</ol>
<p>Conservation du texte d’un signalement : voir la <a href="page:privacy">politique de confidentialité</a>. Nous ne communiquons pas à la personne signalée l’identité de qui l’a signalée.</p>

<h2>Contenu illicite ou mineurs</h2>
<p>Les contenus impliquant des mineurs, la traite des êtres humains ou l’exploitation sexuelle font l’objet d’une <strong>tolérance zéro</strong> et d’un signalement aux autorités compétentes {{{{procédure, autorité destinataire et délais : juriste}}}}.</p>

<h2>Nous écrire</h2>
<p>Pour une question de sécurité qui ne passe pas par l’application, ou pour nous signaler une faille technique : {{{{security@example.invalid}}}}. Voir aussi <a href="page:support">support et contact</a>.</p>
"""),
    'en': ('Safety and reporting', 'Stay safe, block and report a member, and what happens next (provisional version).', f"""
<h1>Safety and reporting</h1>
<p class="lead">Your safety starts with a few simple habits. You also have tools in the application.</p>
<div class="callout danger"><p><strong>In immediate danger,</strong> contact your country’s emergency services before anything else. This service is not an emergency service.</p></div>

<h2>What we do not do</h2>
<p>We do not verify the identity of members. The “verified” badge means a photo review was done, <strong>not</strong> that identity is guaranteed. Age is checked by declaration. Messages are not end-to-end encrypted (see the <a href="page:privacy">privacy policy</a>).</p>

<h2>Protect yourself</h2>
<ul>
  <li><strong>Never send money</strong> to someone you met online: transfer, prepaid card, cryptocurrency, “fees”, “emergency”.</li>
  <li>Be wary of profiles that want to leave the application very quickly, avoid video calls or invent an emergency.</li>
  <li>Do not share your address, your workplace or identity documents.</li>
  <li>For a first meeting: public place, someone you trust informed, video call beforehand, your own transport.</li>
</ul>

<h2>Block</h2>
<p>From a profile or a conversation, “Block” cuts all contact immediately. You will find the list in Settings, “Blocked people”.</p>

<h2>Report</h2>
<p>From a profile, a conversation or a call, “Report” opens a short form. Reasons: request for money, harassment or threats, inappropriate behaviour during a meeting, fake profile or spam, person who seems to be a minor, other. You can add free text.</p>

<h2>What happens after a report</h2>
<ol>
  <li>A team member reviews the report. Target processing time: {{{{time to be confirmed by the owner, no commitment made so far}}}}.</li>
  <li>Depending on severity: warning, temporary suspension, ban, report to the authorities.</li>
  <li>The sanctioned member is told the reason and can appeal once.</li>
  <li>A person suspected of being a minor is, in some cases, suspended as a precaution, then the case is reviewed as a priority.</li>
</ol>
<p>Retention of report text: see the <a href="page:privacy">privacy policy</a>. We do not tell the reported person who reported them.</p>

<h2>Unlawful content or minors</h2>
<p>Content involving minors, human trafficking or sexual exploitation is met with <strong>zero tolerance</strong> and reported to the competent authorities {{{{procedure, receiving authority and deadlines: lawyer}}}}.</p>

<h2>Write to us</h2>
<p>For a safety question that cannot go through the application, or to report a technical vulnerability: {{{{security@example.invalid}}}}. See also <a href="page:support">support and contact</a>.</p>
"""),
}

# ----- Support -----
PAGES['support'] = {
    'fr': ('Support et contact', 'Contacter le support, questions fréquentes et demandes liées à vos données.', f"""
<h1>Support et contact</h1>
<p class="lead">Le plus rapide est d’écrire depuis l’application : Paramètres, « Aide et assistance ». Sinon, utilisez les coordonnées ci-dessous.</p>

<h2>Nous contacter</h2>
<ul>
  <li>Support : {{{{support@example.invalid}}}}</li>
  <li>Données personnelles : {{{{privacy@example.invalid}}}}</li>
  <li>Sécurité et failles techniques : {{{{security@example.invalid}}}}</li>
  <li>Courrier : {{{{adresse postale de l’éditeur}}}}</li>
  <li>Délai de réponse : {{{{à confirmer par le propriétaire, aucun engagement pris à ce jour}}}}</li>
</ul>
<p class="small">Ne nous envoyez jamais votre mot de passe. Nous ne vous le demanderons jamais.</p>

<h2>Questions fréquentes</h2>
<h3>Comment supprimer mon compte ?</h3>
<p>Dans l’application ou depuis la page <a href="page:delete">Supprimer mon compte</a>. Délai de {GRACE_DAYS} jours.</p>
<h3>Comment résilier mon abonnement Premium ?</h3>
<p>Dans les réglages de l’App Store ou de Google Play. Supprimer l’application ou le compte ne résilie pas l’abonnement.</p>
<h3>Comment obtenir une copie de mes données ?</h3>
<p>Dans l’application : Paramètres, « Exporter mes données ». Une demande par jour ; l’archive reste disponible 7 jours.</p>
<h3>Comment signaler ou bloquer quelqu’un ?</h3>
<p>Voir <a href="page:safety">sécurité et signalement</a>.</p>
<h3>J’ai été sanctionné, que faire ?</h3>
<p>Dans l’application : Paramètres, « Sanctions et contestations ». Vous pouvez contester une fois.</p>
<h3>Je n’ai plus accès à mon compte</h3>
<p>Utilisez « Mot de passe oublié » sur l’écran de connexion. Si cela ne suffit pas, écrivez-nous depuis l’adresse e-mail du compte.</p>
"""),
    'en': ('Support and contact', 'Contact support, frequently asked questions and data requests.', f"""
<h1>Support and contact</h1>
<p class="lead">The fastest way is to write from the application: Settings, “Help and support”. Otherwise, use the details below.</p>

<h2>Contact us</h2>
<ul>
  <li>Support: {{{{support@example.invalid}}}}</li>
  <li>Personal data: {{{{privacy@example.invalid}}}}</li>
  <li>Security and technical vulnerabilities: {{{{security@example.invalid}}}}</li>
  <li>Mail: {{{{publisher postal address}}}}</li>
  <li>Response time: {{{{to be confirmed by the owner, no commitment made so far}}}}</li>
</ul>
<p class="small">Never send us your password. We will never ask for it.</p>

<h2>Frequently asked questions</h2>
<h3>How do I delete my account?</h3>
<p>In the application or from the <a href="page:delete">Delete my account</a> page. {GRACE_DAYS}-day delay.</p>
<h3>How do I cancel my Premium subscription?</h3>
<p>In the App Store or Google Play settings. Deleting the application or the account does not cancel the subscription.</p>
<h3>How do I get a copy of my data?</h3>
<p>In the application: Settings, “Export my data”. One request per day; the archive stays available for 7 days.</p>
<h3>How do I report or block someone?</h3>
<p>See <a href="page:safety">safety and reporting</a>.</p>
<h3>I was sanctioned, what can I do?</h3>
<p>In the application: Settings, “Sanctions and appeals”. You can appeal once.</p>
<h3>I can no longer access my account</h3>
<p>Use “Forgot password” on the sign-in screen. If that is not enough, write to us from the account’s e-mail address.</p>
"""),
}

# ----- Suppression de compte -----
DELETE_FR_MSG = ('data-msg-sending="Envoi en cours…" '
                 'data-msg-done="Demande reçue. Si un compte actif existe pour cette adresse, un e-mail contenant un lien de confirmation vient d’être envoyé. Le lien est valable 60 minutes."'
                 ' data-msg-throttled="Trop de demandes. Réessayez dans quelques minutes." '
                 'data-msg-invalid="Adresse invalide." data-msg-error="Une erreur est survenue. Réessayez plus tard ou contactez le support." '
                 'data-msg-unconfigured="Ce formulaire n’est pas encore relié au service (adresse de l’API à renseigner). Utilisez l’application ou le support."')
DELETE_EN_MSG = ('data-msg-sending="Sending…" '
                 'data-msg-done="Request received. If an active account exists for this address, an e-mail with a confirmation link has just been sent. The link is valid for 60 minutes."'
                 ' data-msg-throttled="Too many requests. Try again in a few minutes." '
                 'data-msg-invalid="Invalid address." data-msg-error="Something went wrong. Try again later or contact support." '
                 'data-msg-unconfigured="This form is not yet connected to the service (API address to be set). Use the application or contact support."')

PAGES['delete'] = {
    'fr': ('Supprimer mon compte', 'Comment supprimer votre compte, délai de grâce de 30 jours, ce qui est supprimé et ce qui est conservé.', f"""
<h1>Supprimer mon compte</h1>
<div class="callout"><p>Votre profil est <strong>masqué immédiatement</strong> et vous êtes déconnecté de tous vos appareils. Vos données personnelles sont <strong>anonymisées après {GRACE_DAYS} jours</strong>.</p></div>

<h2>Voie 1 : dans l’application</h2>
<ol>
  <li>Ouvrez l’application et connectez-vous.</li>
  <li>Allez dans <strong>Paramètres</strong>, puis <strong>Supprimer mon compte</strong>.</li>
  <li>Confirmez avec votre mot de passe.</li>
</ol>

<h2>Voie 2 : depuis cette page, sans l’application</h2>
<p>Saisissez l’adresse e-mail de votre compte. Nous vous envoyons un lien de confirmation, <strong>valable 60 minutes</strong>. La suppression n’est demandée que lorsque vous ouvrez ce lien et le confirmez. La réponse est la même que l’adresse corresponde ou non à un compte.</p>
<form method="post" action="@@API@@/api/v1/account-deletion-requests" data-deletion-form="request" {DELETE_FR_MSG}>
  <label for="email">Adresse e-mail du compte</label>
  <input id="email" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="254">
  <button type="submit">Recevoir le lien de confirmation</button>
  <div class="status" role="status" aria-live="polite"></div>
</form>
<p class="small">Adresse du service dans ce formulaire : {{{{à renseigner par l’exploitant, voir docs/runbooks/site-public.md}}}}. Pour un compte créé uniquement avec Google ou Apple (sans mot de passe), la voie 2 n’est pas encore disponible dans tous les cas : écrivez au <a href="page:support">support</a>.</p>
<noscript><p class="small">Sans JavaScript, le formulaire s’envoie quand même, mais la réponse du service s’affiche brute. Vous recevrez le même e-mail.</p></noscript>

<h2>Délai de {GRACE_DAYS} jours</h2>
<ul>
  <li>Pendant {GRACE_DAYS} jours, votre compte est en attente de suppression : profil invisible, sessions fermées.</li>
  <li>Passé ce délai, l’anonymisation est automatique et <strong>définitive</strong>.</li>
  <li>Pour changer d’avis avant la fin du délai : contactez le <a href="page:support">support</a> {{{{procédure d’annulation à confirmer : non vérifiée dans le code}}}}.</li>
</ul>

<h2>Abonnement Premium</h2>
<div class="callout warn"><p><strong>Supprimer le compte ne résilie pas l’abonnement.</strong> Résiliez-le dans les réglages de l’App Store ou de Google Play, sinon la facturation continue.</p></div>

<h2>Ce qui est supprimé</h2>
<p>À l’anonymisation (après {GRACE_DAYS} jours) :</p>
<ul>
  <li>E-mail, mot de passe, téléphone éventuel, appareils et jetons de notification, identités de connexion sociale.</li>
  <li>Profil, préférences, photos et fichiers associés, selfie de vérification, demandes de vérification.</li>
  <li>Le contenu des messages que vous avez envoyés (la conversation reste visible pour l’autre personne, marquée « compte supprimé »).</li>
  <li>Vos likes et passes, vos blocages, vos appels, vos histoires et invitations, vos demandes d’aide et contestations, vos archives d’export.</li>
  <li>L’adresse IP associée à vos consentements.</li>
  <li>Les données brutes d’achat reçues du prestataire d’abonnement qui contiennent votre identifiant.</li>
</ul>

<h2>Ce qui est conservé, et combien de temps</h2>
<div class="table-wrap"><table>
<thead><tr><th scope="col">Élément</th><th scope="col">Conservation</th></tr></thead>
<tbody>
<tr><td>Date de naissance</td><td>Réduite à l’année (pas effacée) {{{{à valider par un juriste}}}}</td></tr>
<tr><td>Ligne de compte minimale (identifiant, statut « supprimé »)</td><td>Tant que des signalements ou sanctions s’y rattachent</td></tr>
<tr><td>Texte libre des signalements concernant ou émis par le compte</td><td>{REPORT_DAYS} jours après leur création, puis effacé (sauf conservation probatoire d’un dossier)</td></tr>
<tr><td>Motif des sanctions</td><td>{SANCTION_DAYS} jours après la sanction, puis remplacé par un marqueur</td></tr>
<tr><td>Si le compte a été suspendu ou banni : empreinte (hash) de l’e-mail et du téléphone, signaux de risque</td><td>Conservés pour empêcher le contournement d’un bannissement. Durée : {{{{à fixer}}}}</td></tr>
<tr><td>Preuves de consentement (sans adresse IP)</td><td>{{{{durée à fixer}}}}</td></tr>
<tr><td>Achats et pièces comptables</td><td>{{{{durée comptable : juriste}}}}</td></tr>
<tr><td>Sauvegardes du serveur</td><td>Une donnée supprimée peut subsister dans une sauvegarde jusqu’à sa rotation (14 jours par défaut {{{{à valider}}}}), sans être restaurée en production</td></tr>
</tbody></table></div>
<p>Voir aussi la <a href="page:privacy">politique de confidentialité</a>.</p>
"""),
    'en': ('Delete my account', 'How to delete your account, the 30-day grace period, what is deleted and what is kept.', f"""
<h1>Delete my account</h1>
<div class="callout"><p>Your profile is <strong>hidden immediately</strong> and you are signed out of all your devices. Your personal data is <strong>anonymised after {GRACE_DAYS} days</strong>.</p></div>

<h2>Way 1: in the application</h2>
<ol>
  <li>Open the application and sign in.</li>
  <li>Go to <strong>Settings</strong>, then <strong>Delete my account</strong>.</li>
  <li>Confirm with your password.</li>
</ol>

<h2>Way 2: from this page, without the application</h2>
<p>Enter the e-mail address of your account. We send you a confirmation link, <strong>valid for 60 minutes</strong>. Deletion is requested only when you open that link and confirm. The answer is the same whether or not the address matches an account.</p>
<form method="post" action="@@API@@/api/v1/account-deletion-requests" data-deletion-form="request" {DELETE_EN_MSG}>
  <label for="email">Account e-mail address</label>
  <input id="email" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="254">
  <button type="submit">Get the confirmation link</button>
  <div class="status" role="status" aria-live="polite"></div>
</form>
<p class="small">Service address in this form: {{{{to be set by the operator, see docs/runbooks/site-public.md}}}}. For an account created only with Google or Apple (no password), way 2 is not yet available in every case: write to <a href="page:support">support</a>.</p>
<noscript><p class="small">Without JavaScript the form still submits, but the service’s answer is shown raw. You will receive the same e-mail.</p></noscript>

<h2>{GRACE_DAYS}-day delay</h2>
<ul>
  <li>For {GRACE_DAYS} days your account is pending deletion: profile invisible, sessions closed.</li>
  <li>After that, anonymisation is automatic and <strong>final</strong>.</li>
  <li>To change your mind before the end of the delay: contact <a href="page:support">support</a> {{{{cancellation procedure to be confirmed: not verified in the code}}}}.</li>
</ul>

<h2>Premium subscription</h2>
<div class="callout warn"><p><strong>Deleting the account does not cancel the subscription.</strong> Cancel it in the App Store or Google Play settings, otherwise billing continues.</p></div>

<h2>What is deleted</h2>
<p>At anonymisation (after {GRACE_DAYS} days):</p>
<ul>
  <li>E-mail, password, phone number if any, devices and notification tokens, social sign-in identities.</li>
  <li>Profile, preferences, photos and related files, verification selfie, verification requests.</li>
  <li>The content of the messages you sent (the conversation stays visible to the other person, marked “deleted account”).</li>
  <li>Your likes and passes, your blocks, your calls, your stories and invitations, your help requests and appeals, your export archives.</li>
  <li>The IP address attached to your consents.</li>
  <li>Raw purchase data received from the subscription provider that contains your identifier.</li>
</ul>

<h2>What is kept, and for how long</h2>
<div class="table-wrap"><table>
<thead><tr><th scope="col">Item</th><th scope="col">Retention</th></tr></thead>
<tbody>
<tr><td>Date of birth</td><td>Reduced to the year (not erased) {{{{to be validated by a lawyer}}}}</td></tr>
<tr><td>Minimal account row (identifier, “deleted” status)</td><td>As long as reports or sanctions refer to it</td></tr>
<tr><td>Free text of reports about or from the account</td><td>{REPORT_DAYS} days after creation, then erased (unless a case is kept as evidence)</td></tr>
<tr><td>Reason for sanctions</td><td>{SANCTION_DAYS} days after the sanction, then replaced by a marker</td></tr>
<tr><td>If the account was suspended or banned: hash of the e-mail and phone number, risk signals</td><td>Kept to prevent ban evasion. Period: {{{{to be set}}}}</td></tr>
<tr><td>Proof of consent (without IP address)</td><td>{{{{period to be set}}}}</td></tr>
<tr><td>Purchases and accounting records</td><td>{{{{accounting period: lawyer}}}}</td></tr>
<tr><td>Server backups</td><td>A deleted item may remain in a backup until it rotates (14 days by default {{{{to be validated}}}}), without being restored to production</td></tr>
</tbody></table></div>
<p>See also the <a href="page:privacy">privacy policy</a>.</p>
"""),
}

# ----- Confirmation de suppression (cible du lien e-mail : APP_WEB_URL/confirm-deletion?token=...) -----
PAGES['confirm'] = {
    'fr': ('Confirmer la suppression', 'Confirmation de la suppression de compte demandée par e-mail.', f"""
<h1>Confirmer la suppression de mon compte</h1>
<p>Vous avez demandé la suppression de votre compte. En confirmant, votre profil est masqué immédiatement et vos données personnelles sont anonymisées après {GRACE_DAYS} jours. Un abonnement Premium n’est pas résilié : faites-le dans la boutique.</p>
<form method="post" action="@@API@@/api/v1/account-deletion-requests/confirm" data-deletion-form="confirm"
 data-msg-sending="Envoi en cours…" data-msg-done="Suppression demandée. Votre profil est masqué. Suppression définitive dans {GRACE_DAYS} jours."
 data-msg-throttled="Trop de demandes. Réessayez dans quelques minutes." data-msg-invalid="Lien invalide ou expiré. Recommencez la demande depuis la page de suppression."
 data-msg-error="Une erreur est survenue. Réessayez plus tard ou contactez le support."
 data-msg-unconfigured="Ce formulaire n’est pas encore relié au service (adresse de l’API à renseigner). Utilisez l’application ou le support.">
  <label for="token">Code de confirmation (rempli automatiquement depuis le lien de l’e-mail)</label>
  <input id="token" name="token" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" required maxlength="200">
  <button type="submit">Confirmer la suppression de mon compte</button>
  <div class="status" role="status" aria-live="polite"></div>
</form>
<noscript><p class="small">Sans JavaScript, le code n’est pas rempli automatiquement : copiez-le depuis l’adresse du lien (la partie après <code>token=</code>).</p></noscript>
<p class="small">Lien expiré ou non demandé par vous ? Ignorez-le, rien n’est supprimé tant que vous ne confirmez pas. <a href="page:delete">Retour à la page de suppression</a>.</p>
"""),
    'en': ('Confirm deletion', 'Confirmation of the account deletion requested by e-mail.', f"""
<h1>Confirm the deletion of my account</h1>
<p>You asked to delete your account. By confirming, your profile is hidden immediately and your personal data is anonymised after {GRACE_DAYS} days. A Premium subscription is not cancelled: do it in the store.</p>
<form method="post" action="@@API@@/api/v1/account-deletion-requests/confirm" data-deletion-form="confirm"
 data-msg-sending="Sending…" data-msg-done="Deletion requested. Your profile is hidden. Final deletion in {GRACE_DAYS} days."
 data-msg-throttled="Too many requests. Try again in a few minutes." data-msg-invalid="Invalid or expired link. Start the request again from the deletion page."
 data-msg-error="Something went wrong. Try again later or contact support."
 data-msg-unconfigured="This form is not yet connected to the service (API address to be set). Use the application or contact support.">
  <label for="token">Confirmation code (filled in automatically from the e-mail link)</label>
  <input id="token" name="token" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" required maxlength="200">
  <button type="submit">Confirm the deletion of my account</button>
  <div class="status" role="status" aria-live="polite"></div>
</form>
<noscript><p class="small">Without JavaScript the code is not filled in automatically: copy it from the link address (the part after <code>token=</code>).</p></noscript>
<p class="small">Expired link, or not requested by you? Ignore it, nothing is deleted until you confirm. <a href="page:delete">Back to the deletion page</a>.</p>
"""),
}

# ---------------------------------------------------------------------------------------------------------------------
# Rendu
# ---------------------------------------------------------------------------------------------------------------------
def out_path(lang, key):
    return ROOT / ('en' if lang == 'en' else '') / PATHS[key]


def rel(from_file: Path, to_file: Path) -> str:
    import os
    return os.path.relpath(to_file, from_file.parent).replace('\\', '/')


def fill(text: str, lang: str, here: Path) -> str:
    text = re.sub(r'\{\{(.+?)\}\}', lambda m: '<mark class="todo">' + (UI[lang]['todo'] % m.group(1)) + '</mark>', text)
    text = text.replace('@@API@@', API_BASE)
    text = text.replace('@@BRAND@@', rel(here, ROOT / 'assets' / 'brand'))
    text = re.sub(r'href="page:(\w+)"', lambda m: 'href="%s"' % rel(here, out_path(lang, m.group(1))), text)
    return text


def render(lang: str, key: str) -> str:
    ui = UI[lang]
    title, desc, body = PAGES[key][lang]
    here = out_path(lang, key)
    other = 'en' if lang == 'fr' else 'fr'
    other_href = rel(here, out_path(other, key))
    assets = rel(here, ROOT / 'assets')
    root_index = rel(here, out_path(lang, 'index'))

    def links(keys):
        return '\n'.join(
            '<li><a href="%s"%s>%s</a></li>' % (rel(here, out_path(lang, k)), ' aria-current="page"' if k == key else '', ui['nav'][k])
            for k in keys)
    nav_bar = links(NAV_BAR)
    nav_menu = links(NAV)
    footer_links = links(NAV_FOOT)
    robots = '<meta name="robots" content="noindex">\n' if key == 'confirm' else ''
    script = '<script src="%s/deletion.js" defer></script>\n' % assets if key in ('delete', 'confirm') else ''
    brand = ui['brand']
    page_title = '%s – %s' % (title, ui['brand'])

    html = f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
{robots}<title>{page_title}</title>
<meta name="description" content="{desc}">
<link rel="alternate" hreflang="{other}" href="{other_href}">
<link rel="icon" href="{rel(here, ROOT / 'favicon.svg')}" type="image/svg+xml">
<link rel="apple-touch-icon" href="{assets}/brand/ayelo-app-icon-1024.png">
<link rel="stylesheet" href="{assets}/tokens.css">
<link rel="stylesheet" href="{assets}/site.css">
</head>
<body class="page-{key}">
<a class="skip" href="#contenu">{ui['skip']}</a>
<div class="banner" role="note"><div class="wrap"><p>{ui['banner']}</p></div></div>
<header class="site"><div class="wrap">
<a class="brand" href="{root_index}"{' aria-current="page"' if key == 'index' else ''}><img class="mark" src="{assets}/brand/ayelo-symbole.svg" alt="" width="32" height="29"><span>{brand}</span></a>
<nav class="nav-bar" aria-label="{ui['dir']}"><ul>
{nav_bar}
</ul></nav>
<a class="lang" href="{other_href}" lang="{other}" hreflang="{other}" aria-label="{ui['switch_label']}">{ui['switch']}</a>
<details class="menu"><summary>{ui['menu']}</summary>
<nav aria-label="{ui['dir']}"><ul>
{nav_menu}
</ul></nav></details>
</div></header>
<main id="contenu"><div class="wrap">
{body.strip()}
</div></main>
<footer class="site"><div class="wrap">
<ul>
{footer_links}
</ul>
<p>{ui['footer']}</p>
</div></footer>
{script}</body>
</html>
"""
    return fill(html, lang, here)


NOT_FOUND = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>Page introuvable – Page not found</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/brand/ayelo-app-icon-1024.png">
<link rel="stylesheet" href="/assets/tokens.css">
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
<div class="banner" role="note"><div class="wrap"><p><strong>Version provisoire, à valider par un juriste.</strong> <span lang="en">Provisional version, to be validated by a lawyer.</span></p></div></div>
<main id="contenu"><div class="wrap">
<h1>Page introuvable</h1>
<p>L’adresse demandée n’existe pas ou a changé. <a href="/">Retour à l’accueil</a>.</p>
<h1 lang="en">Page not found</h1>
<p lang="en">The requested address does not exist or has moved. <a href="/en/">Back to the home page</a>.</p>
</div></main>
</body>
</html>
"""


def main() -> int:
    global API_BASE
    if '--api-base' in sys.argv:
        API_BASE = sys.argv[sys.argv.index('--api-base') + 1].rstrip('/')
        if not API_BASE.startswith('https://'):
            print('--api-base doit commencer par https://')
            return 2
    n = 0
    for key in PATHS:
        for lang in ('fr', 'en'):
            target = out_path(lang, key)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(render(lang, key), encoding='utf-8', newline='\n')
            n += 1
    (ROOT / '404.html').write_text(NOT_FOUND, encoding='utf-8', newline='\n')
    print('pages écrites :', n + 1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
