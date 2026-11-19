# Documents juridiques : BROUILLONS

**Ces documents sont des brouillons rédigés par l'équipe technique pour faciliter le travail d'un juriste. Ils ne sont pas un avis juridique, ne sont pas validés, et ne doivent pas être publiés ni présentés aux utilisateurs ni aux stores tels quels.**

Constitution du projet, principe V bis : les décisions juridiques ne sont pas prises par les agents.

| fichier | contenu | statut |
| --- | --- | --- |
| `01-conditions-utilisation.md` | conditions générales d'utilisation | brouillon |
| `02-politique-confidentialite.md` | politique de confidentialité | brouillon |
| `03-regles-communaute.md` | règles de la communauté et de modération | brouillon |
| `04-matrice-marches.md` | matrice marché × obligation, à compléter par un juriste | **questions ouvertes** |

## Faits techniques que le juriste doit connaître (vérifiables dans le dépôt)
- Âge minimal 18 ans, contrôlé avant la création du compte par déclaration ; aucun contrôle d'identité.
- Données traitées : e-mail, date de naissance, genre et genre recherché, pays d'origine et de résidence, ville, bio, photos, messages, signalements, journal d'audit, identifiant d'appareil (empreinte), adresses IP (limites de débit, consentements pendant leur durée de vie), achats.
- Données sensibles potentielles (article 9 RGPD) : orientation (déduite du genre et du genre recherché), origine, vie sexuelle ou sentimentale (nature du service), photo de selfie pour la vérification (supprimée à la décision).
- Sous-traitants prévus : hébergeur du serveur, Cloudflare R2, RevenueCat, Apple et Google (paiements, notifications), FCM, LiveKit, Resend (e-mail transactionnel ; accord de traitement à valider), éventuel prestataire de modération (non choisi).
- Suppression : masquage immédiat, anonymisation après 30 jours ; sauvegardes conservées 14 jours plus 3 mensuelles (écart à traiter) ; signalements et sanctions conservés un an, hash d'e-mail conservé pour un compte sanctionné.
- Modération : humaine, délais cibles 24 h (2 h pour un mineur suspecté), non encore dotée en personnel.
- Marchés visés : vague 1 France, Belgique, Suisse, Canada francophone ; vague 2 Afrique francophone ; vague 3 États-Unis, Royaume-Uni, Afrique anglophone.
