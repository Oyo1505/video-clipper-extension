# QuickClip for Video (prototype)

Extension Chrome/Edge (Manifest V3) qui permet de decouper un extrait (max 60s)
d'une video YouTube en cours de lecture et de le telecharger en WebM dans le
dossier de telechargement par defaut.

## Comment ca marche

L'extension n'extrait pas le flux video de YouTube directement. Elle capture
la lecture reelle de la balise `<video>` via `HTMLMediaElement.captureStream()`
+ `MediaRecorder`, pendant que la video rejoue la portion selectionnee. C'est
plus robuste qu'une extraction de flux (qui casse a chaque changement cote
YouTube) mais cela veut dire que le clip est genere en temps reel (un clip de
30s prend ~30s a s'enregistrer).

Limites connues :
- Ne fonctionne pas sur du contenu protege (DRM/Widevine, ex: films/series
  payants sur YouTube).
- Le fichier de sortie est en WebM (pas de conversion MP4 pour l'instant).
- Telecharger du contenu YouTube via ce biais reste contraire aux CGU de
  YouTube meme en usage personnel — a utiliser pour du contenu dont vous avez
  les droits ou pour un usage strictement prive.

## Installer en local (mode developpeur)

1. Ouvrir `chrome://extensions` (ou `edge://extensions`).
2. Activer le "Mode developpeur" (coin superieur droit).
3. Cliquer "Charger l'extension non empaquetee" et selectionner le dossier
   `video-clipper-extension`.
4. Aller sur une page `youtube.com/watch?v=...`, un bouton rond rouge 🎬
   apparait en bas a droite.

## Utilisation

1. Lancer la lecture de la video a l'endroit voulu.
2. Cliquer sur le bouton 🎬 pour ouvrir le panneau.
3. Glisser les deux poignees de la timeline pour choisir le debut et la fin
   (60s max entre les deux).
4. "Apercu" pour relire la portion choisie.
5. "Valider et telecharger" : la video est rejouee en temps reel pendant
   l'enregistrement, puis le fichier `.webm` est telecharge automatiquement.

## Pistes d'amelioration futures

- Conversion WebM -> MP4 via ffmpeg.wasm (cout: temps de traitement + poids du
  module wasm a charger).
- Extension a d'autres sites video (Twitch VOD, Vimeo...) en ajoutant leurs
  patterns dans `manifest.json` et en adaptant le selecteur `<video>`.
- Icones/branding de l'extension.
