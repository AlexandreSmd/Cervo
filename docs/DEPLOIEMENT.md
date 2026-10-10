# Mettre Vif en ligne

Résultat : ton site sur `https://ton-domaine`, avec connexion (Google ou lien e-mail), et
l'espace fondateur réservé à ton compte.

## Comment c'est organisé

| Pièce | Service | Rôle | Coût |
| --- | --- | --- | --- |
| Nom de domaine | Cloudflare (`.com`) ou OVH (`.fr`) | L'adresse du site | 8 à 12 € par an |
| Site + aiguillage `/api` | Cloudflare (Worker) | Sert les pages, transmet les appels à l'API | Gratuit |
| API (le « serveur ») | Modal | Calcule les scores, garde les règles | Gratuit (30 $ de crédit offerts par mois) |
| Comptes + base de données | Firebase (Google) | Connexion, questions, parties | Gratuit à ton échelle (offre Spark) |

Tu crées les comptes et achètes le domaine (une seule fois). Ensuite, une seule commande
met tout en ligne : `npm run prod:deploy`.

---

## Étape 1 : le nom de domaine (15 min)

1. Vérifie que le nom est libre :
   - **`.com`** : sur https://domains.cloudflare.com (Cloudflare vend les `.com` au prix coûtant, environ 10 $ par an).
   - **`.fr`** : sur https://www.ovhcloud.com/fr/domains/ (Cloudflare ne vend pas les `.fr`).
2. Crée un compte Cloudflare gratuit : https://dash.cloudflare.com/sign-up
3. Achète le domaine :
   - **`.com` chez Cloudflare** : rien d'autre à faire, il est déjà branché.
   - **`.fr` chez OVH**, puis branche-le sur Cloudflare :
     1. Dans Cloudflare : **Ajouter un domaine** → tape ton domaine → offre **Free**.
     2. Cloudflare affiche **deux serveurs de noms** (du type `xxx.ns.cloudflare.com`).
     3. Dans OVH : **Noms de domaine** → ton domaine → **Serveurs DNS** → **Modifier les serveurs DNS** → colle les deux serveurs Cloudflare → valide.
     4. Attends l'e-mail « votre domaine est actif sur Cloudflare » (souvent moins d'une heure, parfois 24 h).

## Étape 2 : Firebase, comptes et base de données (15 min)

1. Va sur https://console.firebase.google.com avec ton compte Google → **Créer un projet** →
   nom `vif` → désactive Google Analytics → **Créer**.
   Note l'**ID du projet** affiché (par exemple `vif-1a2b3`).
2. **Authentication** (menu de gauche, « Créer ») → **Commencer** → onglet **Mode de connexion** :
   - **Google** → Activer → e-mail d'assistance : ton Gmail → Enregistrer.
   - **Adresse e-mail/Mot de passe** → Activer, et active aussi **Lien envoyé par e-mail (connexion sans mot de passe)** → Enregistrer.
   - **Anonyme** → Activer → Enregistrer. (C'est ce qui permet de jouer sans compte.)
3. Toujours dans Authentication → onglet **Paramètres** → **Domaines autorisés** → **Ajouter un domaine** :
   ajoute ton domaine (`playvif.com`) et `www.` + ton domaine.
4. **Firestore Database** → **Créer une base de données** → emplacement **eur3 (Europe)** →
   **Démarrer en mode production** → Créer. Les règles par défaut interdisent tout accès direct
   depuis le navigateur : c'est voulu, tout passe par l'API.
5. ⚙️ **Paramètres du projet** → onglet **Général** → en bas, **Ajouter une application** → icône
   **</>** (Web) → surnom `vif-web` → **Enregistrer l'application**. Garde la page ouverte :
   tu as besoin de `apiKey`, `authDomain` et `projectId`.
6. ⚙️ **Paramètres du projet** → onglet **Comptes de service** → **Générer une nouvelle clé privée** →
   un fichier `.json` se télécharge. Dans le Terminal :
   ```
   cd ~/Cervo
   mkdir -p secrets
   mv ~/Downloads/*firebase-adminsdk*.json secrets/firebase-admin.json
   ```
   ⚠️ Ce fichier donne un accès total à ta base : ne l'envoie à personne (il est exclu de Git).

## Étape 3 : la configuration de production (5 min)

```
cd ~/Cervo
cp .env.production.example .env.production
open -e .env.production
```
Remplis dans TextEdit, puis enregistre :
- `PROD_DOMAIN` : ton domaine, sans `https://` (`playvif.com`) ;
- `ADMIN_EMAILS` : ton adresse (déjà remplie) ;
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` : les trois valeurs de l'étape 2.5 ;
- `FIRESTORE_DATABASE` : le nom de la base Firestore si tu lui en as donné un (ex. `playvif`), sinon vide.

## Étape 4 : connecter Modal et Cloudflare au Terminal (5 min)

1. Crée un compte sur https://modal.com (bouton « Sign up », avec GitHub ou Google).
2. Dans le Terminal :
   ```
   uvx --python 3.12 --from modal modal setup
   ```
   Le navigateur s'ouvre : valide. Le Terminal affiche « Token verified ».
3. Puis :
   ```
   npx wrangler login
   ```
   Le navigateur s'ouvre sur Cloudflare : **Allow**.

## Étape 5 : mettre en ligne (5 min)

```
npm run prod:check
```
Corrige ce qu'il signale, puis :
```
npm run prod:deploy
```
Cette commande :
1. met l'API en ligne sur Modal, avec la configuration de production ;
2. charge les questions dans la base Firestore ;
3. construit le site et le publie sur Cloudflare, à ton domaine.

À la fin : **« Vif est en ligne → https://ton-domaine »**.

## Étape 6 : ton accès fondateur

1. Ouvre `https://ton-domaine/connexion` → **Continuer avec Google** avec `a.simaillaud@gmail.com`.
2. **Profil** → **Espace fondateur** (ou directement `https://ton-domaine/admin`).
3. **Planning** → **Planifier les jours vides** pour préparer les 4 prochaines semaines.

Seul un compte dont l'e-mail est dans `ADMIN_EMAILS` **et vérifié** (connexion Google ou lien e-mail)
entre dans l'admin. Les outils de développement n'existent pas en ligne.

## Étape 7 : partager

Envoie `https://ton-domaine` à tes amis. Ils jouent tout de suite, sans compte ; ils peuvent
ensuite garder leur progression avec Google ou leur e-mail.

---

## Mettre à jour le site plus tard

```
cd ~/Cervo
git pull
npm run prod:deploy
```
Les nouvelles questions ajoutées dans `content/questions/` sont chargées automatiquement ;
celles créées depuis l'admin sont déjà en ligne.

## En cas de souci

| Symptôme | Solution |
| --- | --- |
| « Connexion impossible » avec Google | Étape 2.3 : ajoute ton domaine aux domaines autorisés |
| Les e-mails de connexion n'arrivent pas | Regarde les indésirables (expéditeur `noreply@…firebaseapp.com`) |
| La première page met 3 secondes | Normal après une pause : l'API se réveille (gratuit). Les suivantes sont rapides |
| `npm run prod:deploy` refuse de démarrer | Lance `npm run prod:check` : il dit ce qui manque |
| Le domaine n'affiche rien | Attends la fin de l'activation Cloudflare (étape 1.3), puis relance `npm run prod:web` |
