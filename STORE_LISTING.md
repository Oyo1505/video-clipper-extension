# Fiche Chrome Web Store

## Nom
QuickClip

## Description courte (max 132 caractères)
Découpez un extrait (60 s max) d'une vidéo pendant sa lecture et enregistrez-le en WebM, grâce à une barre de découpe intégrée au lecteur.

## Description détaillée
QuickClip ajoute un bouton dans la barre de contrôle du lecteur vidéo, ainsi qu'une barre de découpe superposée à la barre de progression.

- Réglez le début et la fin de l'extrait en faisant glisser les poignées.
- Durée maximale : 60 secondes.
- L'extrait est enregistré pendant la lecture puis sauvegardé en WebM sur votre ordinateur.

Fonctionnement : l'extension enregistre la lecture locale de la vidéo dans votre navigateur. La génération se fait donc en temps réel (un extrait de 30 s prend environ 30 s).
Aucune donnée n'est collectée ni envoyée à un serveur.

Limites : ne fonctionne pas sur les contenus protégés par DRM. Format de sortie : WebM uniquement.

À utiliser pour des extraits personnels, dans le respect des droits d'auteur et des conditions d'utilisation des sites.

## Catégorie
Productivité (ou Outils)

## Onglet « Practices » du dashboard

**Objectif unique (single purpose)**
Permettre de découper un extrait court de la vidéo en cours de lecture et de l'enregistrer en local.

**Justification de host_permissions (`*://*.youtube.com/*`)**
Le content script doit s'injecter sur les pages de lecture vidéo pour ajouter le bouton, la barre de découpe et accéder à l'élément `<video>` afin d'en enregistrer la lecture. Aucun autre site n'est concerné.

**Permissions** : aucune permission d'API (`permissions` vide).

**Code distant** : non, tout le code est dans le package.

**Collecte de données** : aucune. Cocher « ne collecte aucune donnée utilisateur » et les 3 certifications.

## Éléments à fournir manuellement
- Captures d'écran 1280×800 (au moins 1) : barre de découpe visible sur une vidéo.
- Tuile promo 440×280 (recommandée).
- URL de politique de confidentialité (voir PRIVACY.md, à héberger par ex. via GitHub Pages).
