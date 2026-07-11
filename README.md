# انصحني — Déploiement avec IA fonctionnelle sur Netlify

## Ce qui a changé par rapport à la version précédente

Avant : l'app appelait directement `api.anthropic.com` depuis le navigateur — cela
ne fonctionne que dans l'aperçu Claude (Anthropic gère cet accès automatiquement
là-bas). Une fois hébergé ailleurs, ce fetch échoue et exposer une clé API dans le
code du navigateur serait de toute façon dangereux (n'importe qui pourrait la
copier et l'utiliser à vos frais).

Maintenant : l'app appelle `/.netlify/functions/ai-proxy`, une petite fonction
serveur qui garde la clé API secrète et fait le relais vers Anthropic.

```
Navigateur  →  /.netlify/functions/ai-proxy  →  api.anthropic.com
(sans clé)      (clé secrète, jamais visible)
```

## Fichiers du projet

```
ansahni_deploy/
├── index.html                      → l'application (inchangée à part les appels IA)
├── netlify.toml                    → dit à Netlify où trouver les fonctions
└── netlify/functions/ai-proxy.js   → le relais sécurisé vers Anthropic
```

## Étape 1 : obtenir une clé API Anthropic

Une clé API est différente de votre abonnement Claude.ai — c'est un accès à
l'usage, facturé séparément. Créez un compte et une clé sur
https://console.anthropic.com (section "API Keys"). Gardez-la secrète.

## Étape 2 : déployer avec la clé (nécessite la ligne de commande cette fois)

⚠️ Important : le glisser-déposer sur `app.netlify.com/drop` **ne supporte pas
les fonctions serveur**. Il faut utiliser la CLI Netlify (une seule fois à
installer) :

```bash
npm install -g netlify-cli
cd ansahni_deploy
netlify login                              # ouvre une page de connexion
netlify init                               # crée/relie le site Netlify
netlify env:set ANTHROPIC_API_KEY sk-ant-votre-cle-ici
netlify deploy --prod                      # met en ligne, fonctions incluses
```

Netlify vous donnera une adresse `https://votre-site.netlify.app` où tout
fonctionne réellement, y compris les appels IA.

## Étape 3 : vérifier

Ouvrez l'app sur cette adresse, faites l'exercice du soir : la reformulation à
chaque étape et le rapport final doivent maintenant venir d'une vraie réponse de
Claude (regardez le badge "✨ صياغة مباشرة من المساعد الذكي").

## Tester en local avant de déployer (optionnel mais recommandé)

```bash
netlify dev
```

Cela lance l'app et la fonction ensemble sur votre machine (`localhost:8888`),
avec la même variable d'environnement, avant de pousser en production.

## Ce qui reste "MVP" dans cette version

- **Les données ne sont pas partagées entre appareils/navigateurs** : tout est
  stocké localement dans le stockage temporaire de l'aperçu Claude pour l'instant.
  Pour une vraie persistance multi-appareils, il faudra une base de données
  (Supabase ou autre) — on peut le faire à l'étape suivante.
- Le stockage `window.storage` utilisé actuellement est spécifique à
  l'environnement d'aperçu Claude ; une fois déployé seul sur Netlify, il faudra
  le remplacer par `localStorage` (ou une vraie base de données) pour que les
  données survivent aux rechargements de page. Dites-moi quand vous voulez que
  je fasse ce changement.

## Sécurité

- La clé `ANTHROPIC_API_KEY` n'existe que côté serveur (variable d'environnement
  Netlify) — jamais dans `index.html`, jamais visible par les utilisateurs.
- Pensez à surveiller votre usage sur console.anthropic.com pour éviter les
  mauvaises surprises de facturation si le trafic augmente.
