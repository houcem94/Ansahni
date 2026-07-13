# انصحني — Activer la vraie authentification + base de données

## Ce qui a changé

Le fichier `web/index.html` bascule automatiquement entre deux modes :

- **Mode démo** (par défaut, rien à faire) : connexion par email seul, données
  stockées dans le cache local — exactement comme avant.
- **Mode réel** (une fois Supabase configuré) : vraie création de compte avec
  mot de passe, données sauvegardées dans une vraie base de données,
  accessibles depuis n'importe quel appareil.

Le code détecte automatiquement lequel utiliser : tant que
`SUPABASE_URL` contient encore `YOUR-PROJECT`, il reste en mode démo.

### Nouveauté : tout est maintenant enregistré, et أنيس suit votre évolution

En mode réel, chaque séance TCC complète (pensée, émotion, preuves, nouvelle
pensée, réponse de l'IA...) est sauvegardée dans la table `cbt_sessions`, et
le planning mensuel dans `monthly_plans`. Chaque jour, le "شعور اليوم"
(émotion principale de la séance TCC) est aussi conservé sur `daily_plans`.

À chaque note de fin de journée, أنيس reçoit désormais l'historique des 6
derniers jours (note, score, émotion principale) et compare explicitement
avec les jours précédents — il peut remarquer une amélioration, une émotion
qui revient souvent, ou une stagnation, et adapter son conseil en
conséquence. C'est un vrai suivi personnalisé, pas juste un commentaire sur
la journée isolée.

## Étape 1 : créer le projet Supabase (gratuit)

1. Compte sur https://supabase.com → New Project
2. Une fois créé, allez dans **Settings → API** et notez :
   - `Project URL`
   - `anon public key`

## Étape 2 : appliquer le schéma de base de données

Deux options :

**Option A — via le tableau de bord (sans ligne de commande, depuis un
navigateur, mobile compris) :**
1. Dans Supabase : **SQL Editor** → **New query**
2. Copiez-collez le contenu de `backend/supabase/migrations/0001_init.sql` → **Run**
3. Répétez avec `0002_seed_content.sql`

**Option B — via la CLI (si vous avez un PC) :**
```bash
npm install -g supabase
supabase login
supabase init
supabase link --project-ref VOTRE_PROJECT_REF
supabase db push
```

## Étape 3 : brancher le front-end

Dans `web/index.html`, cherchez ces deux lignes (proche du début du `<script>`) :
```js
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
```
Remplacez par vos vraies valeurs de l'étape 1. Dès que `SUPABASE_URL` ne
contient plus `YOUR-PROJECT`, le mode réel s'active automatiquement :
écran de connexion avec mot de passe, écran d'inscription séparé, et toutes
les données (planning, points, séries, historique des notes) sauvegardées
dans Supabase au lieu du cache local.

Commitez ce fichier modifié sur GitHub comme d'habitude — Netlify redéploie
automatiquement.

## Étape 4 : vérifier

Créez un compte depuis le site déployé, complétez une journée, puis
déconnectez-vous et reconnectez-vous (ou ouvrez le site sur un autre
appareil avec le même compte) — vos données doivent toujours être là.

## Sécurité

- La clé `anon public` de Supabase est **conçue pour être publique** — les
  règles de sécurité (Row Level Security) déjà en place dans le schéma
  empêchent un utilisateur de voir les données d'un autre.
- La clé `GEMINI_API_KEY` reste uniquement dans les variables d'environnement
  Netlify, comme actuellement — rien ne change de ce côté.

## Ce qui reste à faire éventuellement plus tard

- Confirmation d'email à l'inscription (activée par défaut sur Supabase —
  l'utilisateur recevra un email à confirmer avant de pouvoir se connecter,
  sauf si vous désactivez cette option dans Supabase → Authentication → Settings).
- Réinitialisation de mot de passe oublié.
- Sauvegarde de l'historique complet des séances TCC (actuellement seule la
  note et le score du jour sont conservés ; la table `cbt_sessions` existe
  déjà dans le schéma si vous voulez garder le détail de chaque séance).
