# Architecture de Vif

Ce document explique comment le code est organisé, où se trouve chaque règle, et comment
faire évoluer le produit sans rien casser. Les choix et leurs raisons sont dans `DECISIONS.md`.

## Vue d'ensemble

```
Navigateur (React)  ──/api──▶  API FastAPI (Python)  ──SDK Admin──▶  Firestore
       │                                │
       └── Firebase Auth (jeton) ───────┘  vérifié à chaque requête
```

- Le navigateur **n'accède jamais à Firestore** (`firestore.rules` refuse tout) : toutes les
  lectures et écritures passent par l'API, qui calcule les scores et ne révèle la bonne
  réponse qu'après la réponse.
- **En local**, Firebase est remplacé par ses émulateurs (Auth, Firestore), et Vite transmet
  `/api/*` à l'API. **En production**, l'API tourne sur Modal (`modal_app.py`) et un Worker
  Cloudflare (`infra/cloudflare/`) sert le site et transmet `/api/*`.

## API (`api/cervo/`) : trois couches

| Couche | Rôle | Règle |
| --- | --- | --- |
| `domain/` | Règles métier pures : `catalog` (référentiels), `models` (format d'une question), `scoring` (score 0–100), `daily` (composition du quiz du jour), `stats` (profil) | Aucune entrée/sortie. Testé sans émulateur. |
| `services/` | Cas d'usage sur Firestore : `bank`, `quiz`, `users`, `play`, `planning`, `insights`, `media`, `demo` | Reçoivent le client `db` en argument. Lèvent `ApiError` pour une erreur métier. |
| `web/` | Routes FastAPI : `player`, `admin`, `dev` ; `deps` (authentification, droits, débit) ; `app` (assemblage) | Fines : valider, authentifier, déléguer. Pas de logique métier. |

Autour : `config.py` (lecture de `.env.local`), `firebase.py` (SDK), `clock.py` (dates),
`errors.py`, `tools/` (scripts lancés par `npm run …`), `main.py` (point d'entrée ASGI).

Dépendances autorisées : `web → services → domain`. Jamais l'inverse.

## Données Firestore

| Collection | Contenu | Écrit par |
| --- | --- | --- |
| `questions/{id}` | La banque (format de `domain.models.Question`) | `tools/seed`, admin |
| `daily_quizzes/{AAAA-MM-JJ}` | Les 10 identifiants du jour, dans l'ordre | planning (admin) ou calcul automatique figé à la 1ʳᵉ visite |
| `users/{uid}` | Pseudo, e-mail, agrégats (séries, catégories, piliers) | `services.users`, `services.play` |
| `users/{uid}/attempts/{date}` | La partie du jour : réponses, scores, chrono en cours | `services.play` (transactions) |
| `daily_stats/{date}` | Agrégats du jour pour le tableau de bord | `services.play` (incréments, même transaction) |
| `question_stats/{id}` | Réussite cumulée d'une question | idem |
| `usernames/{pseudo}` | Unicité des pseudos | `services.users` |
| `reports/{id}` | Signalements | joueur |
| `media/{id}` | Photos envoyées depuis l'admin | admin |

Les noms sont centralisés dans `services/collections.py`.

## Garanties importantes

- **Même quiz pour tous** : `daily_quizzes/{date}` est la seule source de vérité. S'il
  n'existe pas, `services.quiz.question_ids` le calcule (déterministe) et le crée de façon
  atomique : le site change de quiz à minuit (heure de Paris) sans intervention.
- **Une partie par jour, dans l'ordre** : `services.play.submit_answer` vérifie la position
  dans une transaction ; la participation, le profil et les statistiques sont écrits ensemble.
- **Chrono honnête** : `start_question` enregistre l'heure de début côté serveur ; une réponse
  au-delà du temps imparti (+ 4 s de marge) vaut 0, et recharger ne relance pas le chrono.
- **Planning verrouillé** dès qu'un joueur a commencé une journée.

## Interface (`web/src/`)

| Dossier | Contenu |
| --- | --- |
| `pages/` | Écrans du joueur : accueil, quiz, résultats, profil, connexion |
| `components/` | Briques du joueur : `AnswerInput` (une saisie par format), `Feedback`, `Timer`, `Pearls`, `QuestionCard`… |
| `admin/` | Espace fondateur : `Dashboard`, `Planning` (+ `planningLogic`, testée), `QuestionsPage`, `QuestionEditor`, `meta` (libellés, modèles) |
| `lib/` | `api` (client typé), `types` (contrats de l'API), `format`, `share`, `csv`, `firebase`, `auth`, `hooks`, `config` |

Les données distantes passent par TanStack Query (`lib/hooks.ts`), le style par Tailwind avec
des couleurs en variables CSS (`index.css`), mode sombre automatique.

## Ajouter un format de réponse (exemple : « carte »)

1. `domain/models.py` : ajouter le type au `Literal`, sa configuration éventuelle, et sa
   fonction `_check_<type>` dans `_ANSWER_CHECKS`.
2. `domain/scoring.py` : `score_<type>` et son `case` dans `score_answer`. Tests dans
   `api/tests/test_scoring.py`.
3. `domain/catalog.py` : libellé dans `ANSWER_FORMATS` (et chrono dans `TYPE_TIME_LIMIT` si besoin).
4. `services/bank.py` : ce que le joueur doit recevoir dans `public_view` (jamais la réponse).
5. `services/demo.py` : une réponse fictive dans `fake_answer`.
6. Interface : type dans `lib/types.ts`, saisie dans `components/AnswerInput.tsx`, affichage de la
   réponse dans `lib/format.ts` (`formatAnswer`), libellé et icône dans `admin/meta.ts`, champs
   dans `admin/QuestionEditor.tsx`.
7. Quelques questions dans `content/questions/`, puis `npm run check`.

## Qualité

| Commande | Ce qu'elle vérifie |
| --- | --- |
| `npm run lint` | Ruff (Python), ESLint, Prettier et TypeScript (interface) |
| `npm run format` | Corrige et reformate automatiquement |
| `npm test` | pytest (dont intégration avec les émulateurs) et Vitest |
| `npm run test:e2e` | Parcours complets dans Chromium (Playwright) |
| `npm run check` | `lint` puis `test` : à lancer avant chaque commit |

La CI GitHub (`.github/workflows/ci.yml`) lance tout cela à chaque push et pull request.
