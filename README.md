# Vif

**Garder son esprit affûté, vif et précis.** 10 questions par jour, sans aide, un score sur 100 par question et la preuve de ta progression.

Stack : API Python (FastAPI, uv) · front React (Vite, TypeScript, Tailwind) · Firebase Auth · Firestore · Modal (API en ligne) · Cloudflare (front et proxy).
En local, Firebase est remplacé par ses **émulateurs** : aucun compte à créer.

## Lancer le projet (une seule commande)

```bash
npm run start:local
```

Puis ouvre **http://localhost:5173**. Ctrl+C pour arrêter (les données sont sauvegardées dans `.emulator-data/`).

**Sur ton téléphone** : connecte-le au même Wi-Fi que l'ordinateur et ouvre l'adresse « Sur ton téléphone » affichée au lancement (par exemple `http://192.168.1.20:5173`). Sur Mac, autorise les connexions entrantes si une fenêtre te le demande.

### Prérequis (à installer une seule fois)

| Outil | Vérifier | Windows | Mac |
| --- | --- | --- | --- |
| Node.js 20+ | `node -v` | `winget install OpenJS.NodeJS.LTS` | `brew install node` |
| Java 17+ | `java -version` | `winget install Microsoft.OpenJDK.21` | `brew install openjdk@21` |
| uv (Python) | `uv --version` | `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 \| iex"` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Git | `git --version` | `winget install Git.Git` | `brew install git` |

Python 3.12 est téléchargé automatiquement par uv s'il manque. `npm run setup` vérifie tout et affiche la commande d'installation exacte de ce qui manque.

## Commandes utiles

| Commande | Rôle |
| --- | --- |
| `npm run start:local` | Setup puis lancement complet (la seule à connaître) |
| `npm run setup` | Vérifie les prérequis, installe les dépendances, crée `.env.local` |
| `npm run dev` | Émulateurs Firebase + API (port 8000) + front (port 5173), ajoute les nouvelles questions |
| `npm run db:reset` | Efface les données des émulateurs et recharge les questions |
| `npm run db:seed:demo` | Ajoute 3 semaines d'historique au compte démo (`demo@cervo.test`) |
| `npm test` | Tests pytest (API) et Vitest (front) |
| `npm run test:e2e` | Parcours complet dans un navigateur (Playwright) |
| `npm run questions:check` | Valide la banque de questions (format, doublons, cohérence) |
| `npm run questions:import -- fichier.json` | Importe un fichier de questions dans la base locale |

Adresses en local : site http://localhost:5173 · API http://localhost:8000/api/docs · console des émulateurs http://127.0.0.1:4000.

## Espace fondateur : http://localhost:5173/admin

En local, clique sur **« Se connecter (local) »**.

| Page | Ce qu'on y fait |
| --- | --- |
| **Tableau de bord** | Joueurs du jour et des 7 derniers jours, score moyen, taux de quiz terminés, courbe sur 30 jours (clic sur un jour = détail), taux de bonnes réponses par question, répartition des scores, questions les plus dures et les plus faciles |
| **Planning** | Les 10 questions de chaque jour à venir, dans l'ordre où les joueurs les verront. « Planifier les 28 prochains jours » remplit les jours vides. Glisser un badge sur un autre : réordonner (même jour) ou échanger (deux jours). Glisser une question de la banque sur un badge : la remplacer. Un jour avec des joueurs est verrouillé |
| **Pas encore posées** | Ta base de questions en réserve (jamais jouées), filtrable par catégorie, difficulté, format et statut, avec leur date si elles sont déjà planifiées. « Nouvelle question » propose des modèles. Import JSON/CSV |
| **Déjà posées** | Les questions déjà jouées, avec la date et le taux de bonnes réponses |
| **Signalements** | Les erreurs signalées par les joueurs, avec accès direct à la question |

Le bloc « Local » de la barre latérale simule des joueurs (pour voir le tableau de bord rempli), ajoute un historique fictif à ton compte ou remet ton quiz du jour à zéro.

### Structure

```
api/cervo/domain/    Règles métier pures (scoring, quiz du jour, statistiques, modèles)
api/cervo/services/  Cas d'usage sur Firestore (partie, planning, statistiques…)
api/cervo/web/       Routes FastAPI (joueur, admin, dev)
web/src/             Interface React (pages, components, admin, lib)
content/questions/   Banque de questions (JSON)
scripts/             Scripts npm (Node) et génération des illustrations
infra/, modal_app.py Mise en ligne (Cloudflare, Modal)
docs/                Architecture et captures d'écran
```

Détails : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Pour contribuer : [CONTRIBUTING.md](CONTRIBUTING.md).

## Qualité du code

| Commande | Rôle |
| --- | --- |
| `npm run lint` | Ruff (Python), ESLint + Prettier + TypeScript (interface) |
| `npm run format` | Corrige et reformate automatiquement |
| `npm run check` | Qualité puis tests : à lancer avant chaque commit |

La CI GitHub lance qualité, tests, build et parcours de bout en bout à chaque push.

## Mise en ligne

Tout est prêt : domaine, Firebase (connexion et base), Modal (API) et Cloudflare (site).
Guide pas à pas : **[docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)**, puis une seule commande :

| Commande | Rôle |
| --- | --- |
| `npm run prod:check` | Vérifie que la configuration et les comptes sont prêts |
| `npm run prod:deploy` | Met en ligne l'API, charge les questions, publie le site |
| `npm run prod:api` / `prod:seed` / `prod:web` | Une seule de ces étapes |
