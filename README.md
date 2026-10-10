# Cervo Daily

**Garde ton cervo affûté.** 10 questions par jour, sans aide, un score sur 100 par question et la preuve de ta progression.

Stack : API Python (FastAPI, uv) · front React (Vite, TypeScript, Tailwind) · Firebase Auth · Firestore · Modal (API en ligne) · Cloudflare (front et proxy).
En local, Firebase est remplacé par ses **émulateurs** : aucun compte à créer.

## Lancer le projet (une seule commande)

```bash
npm run start:local
```

Puis ouvre **http://localhost:5173**. Ctrl+C pour arrêter (les données sont sauvegardées dans `.emulator-data/`).

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
| `npm run dev` | Émulateurs Firebase + API (port 8000) + front (port 5173), charge les questions si besoin |
| `npm run db:reset` | Efface les données des émulateurs et recharge les questions |
| `npm run db:seed:demo` | Ajoute 3 semaines d'historique au compte démo (`demo@cervo.test`) |
| `npm test` | Tests pytest (API) et Vitest (front) |
| `npm run test:e2e` | Parcours complet dans un navigateur (Playwright) |
| `npm run questions:check` | Valide la banque de questions (format, doublons, cohérence) |
| `npm run questions:import -- fichier.json` | Importe un fichier de questions dans la base locale |

Adresses en local : site http://localhost:5173 · API http://localhost:8000/api/docs · console des émulateurs http://127.0.0.1:4000.

## Outils de développement (local uniquement)

Le bouton **🛠 Dev** en bas à droite permet : connexion démo ou admin en un clic, rejouer le quiz du jour, ajouter 3 semaines d'historique fictif, repartir d'une session invité.

- **Lien magique** : en local, aucun e-mail n'est envoyé. Le lien s'affiche dans le terminal (émulateur Auth) et un bouton « Ouvrir le lien magique » apparaît sur la page de connexion.
- **Admin** : `/admin`, réservé aux e-mails de `ADMIN_EMAILS` (par défaut `admin@cervo.test`, accessible via « Connexion admin »).

## Ajouter des questions

1. **Depuis l'admin** (`/admin`) : formulaire avec aperçu, ou import JSON/CSV.
2. **Dans le code** : ajouter des objets dans `content/questions/*.json`, lancer `npm run questions:check`, puis `npm run db:reset` (ou `questions:import`).

Format d'une question :

```json
{
  "id": "estimation-001",
  "type": "numeric",
  "category": "estimation",
  "tags": ["japon", "architecture"],
  "difficulty": 2,
  "prompt": "Quelle est la hauteur de la Tokyo Skytree, en mètres ?",
  "image_url": "/questions/monument-skytree.svg",
  "image_alt": "Silhouette stylisée de la tour",
  "image_credit": "Illustration originale Cervo Daily",
  "correct_answer": 634,
  "numeric_config": { "scale": "log", "factor": 3, "unit": "m" },
  "explanation": "La Tokyo Skytree mesure 634 m.",
  "source_url": "https://fr.wikipedia.org/wiki/Tokyo_Skytree",
  "status": "published"
}
```

Types : `binary` (true/false), `mcq` (4 `choices`, `correct_answer` = texte du bon choix), `numeric` (`numeric_config` : `linear` + `tolerance`, ou `log` + `factor`, `exact_margin` optionnel), `short_text` (`accepted_aliases`).
Catégories : `culture`, `logique`, `reflexion`, `geographie`, `histoire`, `sciences`, `nature`, `arts`, `sport`, `estimation`, `vrai_faux`.

Les illustrations sont générées par `uv run --project api python scripts/generate_illustrations.py`.

## Structure

```
api/          API FastAPI (cervo/scoring.py, daily.py, stats.py : modules purs testés)
web/          Front React (src/pages, src/components, src/lib, e2e/)
content/      Banque de questions (JSON)
scripts/      Scripts npm (Node) et génération des illustrations
infra/        Worker Cloudflare (mise en ligne)
modal_app.py  Déploiement de l'API sur Modal
docs/screenshots/  Captures d'écran (390 px et 1280 px)
```

## Mise en ligne (après le MVP)

1. Créer un projet Firebase (Authentication avec « Lien e-mail », Firestore), déployer `firestore.rules`.
2. API : `modal deploy modal_app.py` avec un secret Modal `cervo-firebase` (voir l'en-tête de `modal_app.py`).
3. Front : `npm run build --workspace web` avec `VITE_USE_FIREBASE_EMULATOR=false`, `VITE_DEV_TOOLS=false` et la vraie config Firebase (`VITE_FIREBASE_*`), puis Cloudflare (`infra/cloudflare/`).
4. Cloudflare : domaine, Worker qui proxifie `/api/*` vers Modal, règle de limitation de débit sur `/api/answer`.
