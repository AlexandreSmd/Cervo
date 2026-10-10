# Product Management — Vif

*Cahier des charges de la V1, destiné à Claude Code*

---

## Vision et mission

Vif est la salle de sport quotidienne du cerveau, pensée pour une époque où l'IA réfléchit de plus en plus à notre place.

### Le constat

L'IA répond à presque tout en quelques secondes : elle rédige, résume, calcule, recommande. C'est utile, mais chaque fois qu'on lui délègue une réflexion, on s'en exerce un peu moins. Retenir, raisonner et estimer sont des capacités qui s'entretiennent, comme un muscle. Vif propose un rituel simple et agréable pour les garder en forme.

### Vision

Un monde où chacun reste capable de penser par lui-même, même entouré d'IA.

### Mission

**Garder son esprit affûté, vif et précis.**

Concrètement : donner à chacun, chaque jour, 5 à 10 minutes pour réfléchir seul : 10 questions, sans aide, un score sur 100 par question, et la preuve de sa progression dans le temps.

### Baseline

**Garde ton esprit affûté, vif et précis.** Variantes à tester : « Dix questions par jour. Zéro IA. », « Réfléchis encore un peu. »

### Principes qui en découlent

- **Sans aide** : on répond de tête, sans moteur de recherche ni assistant. C'est le cœur de la promesse, dit clairement dès l'accueil.
- **Court et quotidien** : 10 questions, pas une de plus. Un rituel, pas une corvée.
- **Honnête** : un score précis sur 100, sans flatterie, avec la bonne réponse et une explication à chaque fois.
- **Pas contre l'IA** : l'IA reste un excellent outil. Vif entraîne ce qu'on garde pour soi, sans faire la morale.
- **Visible** : le profil montre la forme du cerveau et son évolution, comme un suivi d'entraînement.

### Les quatre piliers de l'entraînement

| Pilier | Ce qu'il entraîne | Catégories concernées | Exemple |
| --- | --- | --- | --- |
| Raisonnement | Déduire, repérer une règle, éviter les pièges | Logique, Réflexion | Compléter la suite 2, 6, 18, 54 |
| Estimation | Raisonner en ordres de grandeur | Estimation, Géographie, Sciences | Deviner la hauteur d'une tour sur photo |
| Mémoire et culture | Se souvenir, relier des connaissances | Culture générale, Histoire, Arts et culture, Nature, Sport | Qui a peint La Joconde ? |
| Esprit critique | Douter des idées reçues | Vrai ou faux | « Les chauves-souris sont aveugles » |

### Pour qui

Les personnes qui utilisent l'IA au quotidien (étudiants, actifs, curieux) et qui veulent rester maîtres de leur réflexion. Pas besoin d'être un expert : trois niveaux de difficulté permettent à chacun de progresser.

### Ce que la vision change dans le produit

| Décision | Raison |
| --- | --- |
| Au moins 4 questions sur 10 viennent des piliers Raisonnement, Estimation ou Esprit critique (s'ajoute aux règles de la section 7) | La culture pure se cherche en deux secondes ; réfléchir, non |
| Message « sans aide » sur l'accueil et avant la première question | La règle du jeu repose sur la confiance, il faut la rendre explicite |
| Aucune fonction d'IA visible pour le joueur : pas d'indice généré, pas de chatbot | Le produit doit incarner ce qu'il défend |
| Pas de chrono en V1 | On veut réfléchir, pas réagir vite sous stress |
| Le profil affiche un score par pilier (la « forme du cerveau ») et son évolution | C'est la preuve de progression promise par la mission |
| Ton de coach : encourageant après une erreur, jamais culpabilisant ni scolaire | Le but est de donner envie de revenir demain |
| Pas de classement public en V1 | On ne peut pas empêcher de tricher ; limiter l'enjeu garde le jeu sain |

### Ce que Vif n'est pas

- Pas un outil contre l'IA ou contre la technologie.
- Pas un jeu de compétition stressant.
- Pas une école : on apprend en jouant, personne ne note ni ne juge.

### Comment saurons-nous que la mission avance

Ces cibles sont des hypothèses de départ, à ajuster après les premiers retours.

| Indicateur | Cible V1 |
| --- | --- |
| Quiz commencés qui sont terminés | 85 % ou plus |
| Joueurs qui reviennent 7 jours après leur premier quiz | 25 % ou plus |
| Série moyenne des joueurs actifs | 4 jours ou plus |
| Joueurs dont le score moyen progresse après 30 jours | 60 % ou plus |

---

## Livraison du MVP : localhost en une commande

Le MVP est terminé quand, après avoir collé le prompt ci-dessous dans Claude Code, le porteur du projet ouvre http://localhost:5173 et peut jouer, voir son profil et ajouter des questions, sans créer aucun compte externe. La stack est imposée : backend Python, frontend React, authentification Firebase, base Firestore, infrastructure Modal, réseau Cloudflare. En local, Firebase est remplacé par ses émulateurs ; Modal et Cloudflare ne servent qu'à la mise en ligne. Cette section prime sur le reste du document en cas de contradiction.

### Ce que le porteur du projet fait lui-même (une seule fois)

| Outil | Vérification dans le terminal | Remarque |
| --- | --- | --- |
| Node.js 20 ou plus | `node -v` | Front, scripts et émulateurs Firebase |
| Python 3.12 ou plus | `python --version` | Backend |
| uv | `uv --version` | Gestionnaire d'environnement Python |
| Java 17 ou plus | `java -version` | Requis par l'émulateur Firestore |
| Git | `git --version` |  |
| GitHub CLI (`gh`) | `gh auth status` | Une fois installé, lancer `gh auth login` |
| Claude Code | `claude` | Déjà installé |

1. Exporter ce document en Markdown (menu du document) et l'enregistrer sous le nom `PRODUCT.md` dans un dossier vide, par exemple `cervo-daily`.
2. Ouvrir un terminal dans ce dossier et lancer `claude`.
3. Coller le prompt ci-dessous.
4. Attendre le rapport final de Claude Code, puis ouvrir le lien qu'il affiche.

### Prompt à coller dans Claude Code

```text
Tu es le développeur unique du projet Vif. Lis PRODUCT.md en entier avant de commencer, en particulier la section « Livraison du MVP : localhost en une commande ».

Stack imposée, à ne pas changer : backend Python (FastAPI, uv), frontend React (Vite, TypeScript), authentification Firebase, base Firestore, infrastructure Modal, réseau Cloudflare. En local, utilise les émulateurs Firebase (Auth et Firestore) : je n'ai aucun compte Firebase, Modal ou Cloudflare à créer pour le MVP.

Objectif : un MVP qui tourne sur http://localhost:5173, que je lance avec une seule commande : npm run start:local.

1. Vérifie les prérequis (Node, Python, uv, Java, Git, gh). S'il en manque un, donne-moi la commande d'installation exacte pour mon système.
2. Initialise le projet dans le dossier courant (git init, branche main).
3. Crée un dépôt GitHub privé nommé cervo-daily avec : gh repo create cervo-daily --private --source=. --remote=origin. Si gh n'est pas connecté, arrête-toi et dis-moi quelle commande lancer.
4. Construis le projet par itérations (section 15 de PRODUCT.md). Après chaque itération : tests, commit clair, git push.
5. Respecte la section « Livraison du MVP » : scripts npm, émulateurs Firebase, 120 questions minimum chargées au premier lancement, variables d'environnement par défaut qui marchent en local.
6. Ne me pose aucune question sauf blocage réel. Note chaque décision dans DECISIONS.md.
7. À la fin, fais toutes les vérifications de la section « Vérification avant de déclarer terminé », lance le serveur, puis donne-moi l'URL et un rapport court : ce qui marche, ce qui est simulé, les commandes utiles.
```

### Dépôt GitHub

- Dépôt privé, nommé `cervo-daily`, branche principale `main`.
- Un commit par étape utile, avec un message court qui dit ce qui change.
- Un `.gitignore` qui exclut `node_modules`, `.venv`, `__pycache__`, `web/dist`, `.emulator-data/` et `.env*` (sauf `.env.example`).
- Jamais de secret ni de clé de compte de service dans le dépôt.
- Si `gh` n'est pas disponible ou pas connecté : travailler quand même en local avec des commits, puis dire au porteur comment créer le dépôt et pousser.

### Scripts du projet

| Commande | Rôle |
| --- | --- |
| `npm run start:local` | Enchaîne `setup` puis `dev`. C'est la seule commande à connaître |
| `npm run setup` | Vérifie les prérequis, installe les dépendances (`npm` et `uv sync`), crée `.env.local` |
| `npm run dev` | Lance en parallèle les émulateurs Firebase, l'API FastAPI (port 8000) et le front Vite (port 5173), puis charge les questions si Firestore est vide |
| `npm run db:reset` | Efface les données de l'émulateur et recharge les questions |
| `npm run db:seed:demo` | Ajoute 3 semaines d'historique fictif pour voir le profil rempli |
| `npm test` | Tests `pytest` et Vitest |
| `npm run test:e2e` | Parcours de bout en bout (Playwright) |
| `npm run questions:check` | Valide le format de la banque, détecte les doublons |
| `npm run questions:import` | Importe un fichier JSON de questions |

Les scripts doivent fonctionner sur macOS, Linux et Windows (scripts Node ou Python, pas de bash seul). Le `package.json` racine ne fait qu'orchestrer.

### Données fournies dès le premier lancement

- Les questions sont écrites dans `content/questions/*.json`, versionnées dans Git, et chargées dans Firestore par un script Python au premier lancement (puis seulement si la base est vide). Minimum 120 questions pour déclarer le MVP prêt (cible : 300), ce qui permet 12 jours sans répétition.
- Pour que le jeu fonctionne tout de suite, ces questions sont publiées par défaut. L'admin permet de les retirer. Le porteur relira la banque ensuite.
- Les données des émulateurs sont conservées dans `.emulator-data/` entre deux lancements.
- Outils de développement visibles uniquement en local (`VITE_DEV_TOOLS=true`, routes `/api/dev/*` actives seulement si `APP_ENV=local`) : connexion démo ou admin en un clic, rejouer le quiz du jour, ajouter de l'historique fictif.
- Les photos : fichiers libres de droits dans `web/public/questions/`, ou à défaut illustrations SVG avec la mention « illustration ».

### Variables d'environnement

Un seul fichier `.env.local` à la racine, lu par l'API et par Vite.

| Variable | Valeur par défaut en local | Rôle |
| --- | --- | --- |
| `APP_ENV` | `local` | Active les outils de développement |
| `FIREBASE_PROJECT_ID` | `demo-cervo-daily` | Projet fictif pour les émulateurs |
| `FIRESTORE_EMULATOR_HOST` | `127.0.0.1:8080` | Fait pointer l'API vers l'émulateur Firestore |
| `FIREBASE_AUTH_EMULATOR_HOST` | `127.0.0.1:9099` | Fait pointer l'API vers l'émulateur Auth |
| `ADMIN_EMAILS` | `admin@cervo.test` | Comptes autorisés à utiliser `/admin` |
| `TIMEZONE` | `Europe/Paris` | Fuseau qui définit le changement de jour |
| `VITE_USE_FIREBASE_EMULATOR` | `true` | Le front utilise les émulateurs |
| `VITE_DEV_TOOLS` | `true` | Affiche les outils de développement |

### Structure du dépôt

```text
cervo-daily/
  PRODUCT.md            ce document
  README.md             lancer, tester, ajouter des questions
  DECISIONS.md          décisions prises par Claude Code
  .env.example
  package.json          scripts d'orchestration (npm run ...)
  firebase.json         configuration des émulateurs Auth et Firestore
  firestore.rules       accès client interdit, tout passe par l'API
  modal_app.py          point d'entrée Modal (mise en ligne de l'API)
  content/questions/    banque de questions (JSON)
  api/                  backend Python (FastAPI, uv)
    pyproject.toml
    cervo/              routes, auth, accès Firestore
    cervo/scoring.py    calcul des scores (module pur, testé)
    cervo/daily.py      quiz du jour (déterministe, testé)
    cervo/stats.py      statistiques du profil
    tests/              tests pytest
  web/                  frontend React (Vite, TypeScript)
    src/pages/          accueil, quiz, résultats, profil, admin
    src/components/     composants dont les 10 perles
    src/lib/            client API, Firebase
    e2e/                tests Playwright
  scripts/              setup, chargement des questions, vérification
  .emulator-data/       données des émulateurs (ignorées par Git)
  docs/screenshots/     captures d'écran du MVP
```

### Direction visuelle

Une maquette jouable a déjà été validée dans ses grandes lignes : le MVP la reprend.

- **Motif signature** : une rangée de 10 perles, une par question. Elles se colorent selon le score (vert à partir de 80, orange de 40 à 79, rouge en dessous de 40) et réapparaissent sur l'accueil, la progression, les résultats et l'historique.
- **Couleurs (mode clair)** : fond `#F2F4FB`, texte `#14183A`, accent violet `#5B4BFF`, vert `#1FA971`, orange `#F2A33A`, rouge `#E5484D`. Un mode sombre équivalent (fond `#0E1126`, accent `#8A7EFF`).
- **Typographies** : Bricolage Grotesque pour les titres, DM Sans pour le texte.
- **Ton** : coach encourageant, jamais scolaire ni culpabilisant. Titre d'accueil : « Garde ton esprit affûté, vif et précis. »
- **Mobile d'abord** : une colonne de 560 px maximum, boutons larges, pas de chrono.

### Vérification avant de déclarer terminé

Claude Code fait lui-même ces vérifications et corrige ce qui échoue.

1. Dans un dossier temporaire, cloner le dépôt et lancer `npm run start:local` depuis zéro (sans `node_modules`, sans `.venv`, sans données d'émulateur) : le site s'ouvre sur http://localhost:5173 avec les questions chargées.
2. Les tests `pytest` et Vitest passent.
3. Un test Playwright joue un quiz complet en session anonyme (10 questions), ouvre les résultats puis le profil, crée un compte avec le lien magique (récupéré via l'API REST de l'émulateur Auth) en vérifiant que l'historique est conservé, puis ajoute une question depuis l'admin.
4. Des captures d'écran de l'accueil, d'une question, du feedback, des résultats et du profil, en 390 px et en 1280 px de large, sont enregistrées dans `docs/screenshots/`.
5. Le code est poussé sur GitHub.
6. Le rapport final indique l'URL, ce qui marche, ce qui est simulé ou manquant, et les commandes utiles.

### Règles pour avancer seul

- Poser une question au porteur uniquement en cas de blocage réel (par exemple `gh` non connecté ou Node trop ancien). Sinon, décider et noter dans `DECISIONS.md`.
- Quand une commande échoue, diagnostiquer et corriger. Après trois tentatives différentes sans succès, expliquer le problème clairement.
- Aucun service payant et aucun compte externe pour le MVP.
- Ne rien installer globalement sans le dire.
- Si un choix technique de ce document pose problème, proposer mieux et le justifier dans `DECISIONS.md`.

### Après le MVP : mise en ligne

Hors périmètre de la première livraison, mais le code doit le permettre :

1. Créer un vrai projet Firebase (Authentication avec lien magique, Firestore) et y déployer `firestore.rules`.
2. Déployer l'API sur Modal avec `modal deploy`, les clés du compte de service Firebase étant stockées dans un secret Modal.
3. Déployer le front sur Cloudflare Pages.
4. Dans Cloudflare : configurer le domaine, ajouter le Worker qui proxifie `/api/*` vers l'API Modal et une règle de limitation de débit sur `/api/answer`.

---

## 0. Comment utiliser ce document (instructions pour Claude Code)

Tu es le seul développeur de ce projet. Le porteur du projet ne code pas et ne relira pas le code : il juge uniquement le résultat dans le navigateur. Donc :

1. Lis tout le document avant d'écrire la moindre ligne.
2. Travaille par itérations (section 15). À la fin de chaque itération : le projet démarre, les tests passent, tu résumes en 5 lignes ce qui marche et ce qui reste.
3. Quand une décision n'est pas spécifiée, choisis l'option la plus simple et note-la dans `DECISIONS.md`.
4. Écris des tests automatisés pour tout ce qui est logique métier (calcul des scores, sélection des questions du jour, stats). Ne teste pas le pixel-perfect.
5. Ne construis rien de ce qui est listé en « Hors périmètre V1 » (section 3), mais prépare le terrain (modèle de données, structure) pour ne pas avoir à tout refaire.
6. Le nom du produit doit être une constante unique (`APP_NAME`) pour pouvoir le changer en une ligne.

---

## 1. Concept du produit

**Une page web, pas une application.** Chaque jour, tu viens, tu réponds à **10 questions** variées (culture générale, logique, réflexion, estimation…), tu obtiens un **score sur 100 par question**, puis un score du jour sur 100. Tu reviens le lendemain. Tu suis ta progression dans un profil avec des statistiques. À terme, tu te mesures à tes amis.

Inspiration : la « Table des Savoirs » (quotidien, court, ludique), le principe de GeoGuessr (score proportionnel à la proximité de la réponse), les jeux quotidiens type Wordle (même contenu pour tout le monde, rituel quotidien).

**Promesse :** 5 à 10 minutes par jour pour exercer ton cerveau et savoir où tu en es vraiment.

**Public :** francophones curieux, 15 à 60 ans, sur mobile en priorité (usage quotidien dans le métro, le matin, etc.).

**Langue de l'interface et des questions :** français. Prévoir l'internationalisation plus tard sans l'implémenter.

---

## 2. Principes de produit

- **Simple et rapide** : on peut jouer sans compte, en moins de 10 secondes après l'arrivée sur la page.
- **Mobile-first**, ensuite desktop.
- **Un rituel, pas une corvée** : 10 questions, pas une de plus. Pas de mode illimité en V1.
- **Le même set de 10 questions pour tout le monde chaque jour** (indispensable pour comparer avec les amis plus tard).
- **Feedback pédagogique** : après chaque réponse, on affiche la bonne réponse, le score et une courte explication (« le saviez-vous »).
- **Équité** : pas de chrono stressant en V1, pas de pénalité de vitesse.
- **Design sobre et chaleureux** : typographie lisible, beaucoup d'espace, une couleur d'accent, animations légères. Mode clair et mode sombre.

---

## 3. Périmètre

### Dans la V1

- Page d'accueil avec le quiz du jour
- Déroulé des 10 questions (texte, image optionnelle)
- Quatre types de questions : **binaire (vrai/faux), QCM, numérique, suite logique / réponse courte** (voir section 5)
- Score sur 100 par question + score du jour + écran de résultats détaillé
- Une seule participation par jour et par joueur
- Profil : historique par jour, revue des questions passées (réponse donnée vs bonne réponse), statistiques globales et par catégorie
- Compte utilisateur simple (email, lien magique) **et** mode invité (connexion anonyme Firebase, conservée et rattachée au compte à l'inscription)
- Back-office minimal pour ajouter des questions (fichier ou page protégée, voir section 11)
- Banque initiale d'au moins 300 questions (voir section 12 pour le format ; Claude Code en génère un premier lot, vérifiable)
- Partage du résultat du jour (texte copiable avec emojis, type Wordle)

### Hors périmètre V1 (à prévoir dans l'architecture, pas à construire)

- Amis, classements entre amis, défis
- Ligues, badges, succès
- Notifications / e-mails de rappel
- Questions audio / vidéo
- Mode « entraînement » illimité
- Monétisation, abonnement
- Application mobile native
- Multilingue

---

## 4. Parcours utilisateur

1. **Arrivée** sur la page. On voit : le nom, la date du jour, un bouton « Commencer le quiz du jour », la série de jours consécutifs (streak) si elle existe. Si le quiz du jour est déjà fait : on voit le score du jour et un lien vers le détail.
2. **Question 1 à 10** : une question à la fois, barre de progression (1/10), catégorie affichée sous forme de tag coloré, image si présente, champ de réponse adapté au type. Bouton « Valider ».
3. **Feedback immédiat** après chaque validation : score de la question (0 à 100, avec une jauge animée), bonne réponse, ta réponse, explication courte, source si disponible. Bouton « Question suivante ».
4. **Écran final** : score du jour sur 100 (moyenne des 10), détail par question (couleur : vert ≥ 80, orange 40–79, rouge < 40), évolution de la streak, bouton « Partager », lien vers le profil.
5. **Retour le lendemain** : nouveau set de 10 questions à minuit (fuseau Europe/Paris).

L'utilisateur ne peut pas revenir en arrière sur une question déjà validée. Si il quitte en cours de route, sa progression est sauvegardée et il reprend où il s'était arrêté.

---

## 5. Types de questions et calcul du score

Chaque question donne un **score entier de 0 à 100**. Le score du jour est la moyenne arrondie des 10 scores. Toute la logique de scoring vit dans un module pur, isolé et testé (`scoring`).

### 5.1 Binaire (vrai/faux)

- Bonne réponse : 100. Mauvaise : 0.

### 5.2 QCM (4 choix, un seul correct)

- Bonne réponse : 100. Mauvaise : 0. Ordre des choix mélangé de façon stable pour une question donnée.

### 5.3 Numérique (estimation)

C'est le type vedette : « Quelle est la hauteur de cette tour ? », « En quelle année… ? », « Combien d'habitants… ? ».

Chaque question numérique définit une **échelle** :

- **Échelle linéaire** (années, pourcentages, petites valeurs) : `score = max(0, 100 × (1 − |réponse − vérité| / tolérance))`. `tolérance` est définie par question (ex. pour une année : 50 ans).
- **Échelle logarithmique** (populations, distances, hauteurs, prix, tout ce qui varie sur plusieurs ordres de grandeur) : `score = max(0, 100 × (1 − |ln(réponse / vérité)| / ln(facteur)))`. `facteur` est défini par question (par défaut 3, soit « à un facteur 3 près = 0 point »).
- Une réponse exacte (ou à moins de 1 % près, ou dans la marge `exact_margin` de la question) donne 100.
- Réponse négative, nulle ou absurde en échelle log : 0.
- Arrondir à l'entier le plus proche.

Exemples (log, facteur 3) : vérité 634 m, réponse 500 m → ln(634/500)=0,237 ; ln 3=1,099 ; score ≈ 78. Réponse 200 m → score ≈ 0.

### 5.4 Suite logique / réponse courte

- Réponse attendue : nombre ou mot. Comparaison normalisée (casse, accents, espaces, ponctuation ignorés). Liste d'alias acceptés par question.
- Bon : 100. Mauvais : 0. (Pour les réponses numériques de suites logiques, comparer exactement.)

### 5.5 Prévu plus tard (ne pas construire)

Classement/ordre (score partiel), placement sur carte (score selon la distance), choix multiples à plusieurs bonnes réponses.

---

## 6. Catégories et tags

Chaque question a **une catégorie principale** et **des tags libres**. Catégories de départ :

- **Culture générale**
- **Logique**
- **Réflexion** (énigmes, pièges, raisonnement)
- **Géographie**
- **Histoire**
- **Sciences**
- **Nature et animaux**
- **Arts et culture**
- **Sport**
- **Estimation** (tout ce qui demande de deviner une grandeur)
- **Vrai ou faux**

Exemples de tags : `japon`, `architecture`, `espace`, `années-80`, `facile`, `difficile`.

Chaque question a aussi une **difficulté de 1 à 3** (facile, moyen, difficile).

---

## 7. Composition du quiz quotidien

- 10 questions par jour, identiques pour tous.
- Contraintes de composition : au moins 5 catégories différentes, au plus 3 questions de la même catégorie, au moins 2 questions numériques, au moins 1 question avec image, répartition de difficulté 4 faciles / 4 moyennes / 2 difficiles.
- **Génération déterministe** : à partir de la date (graine = `YYYY-MM-DD`) et de la banque. Même date = même quiz, sans stockage obligatoire (mais on peut stocker le résultat dans une table `daily_quizzes` pour figer l'historique).
- Une question ne réapparaît pas avant d'avoir épuisé la banque (ou au moins 90 jours).
- Si la banque est insuffisante pour respecter les contraintes, assouplir dans l'ordre : difficulté, puis catégories, puis nombre d'images.
- Fuseau de référence : Europe/Paris. Le changement de jour se fait à minuit heure de Paris.

---

## 8. Pages et écrans

| Page | URL | Contenu |
| --- | --- | --- |
| Accueil | `/` | Quiz du jour, streak, bouton commencer / voir résultats |
| Quiz | `/jouer` | Les 10 questions une par une |
| Résultats du jour | `/resultats/AAAA-MM-JJ` | Score global, détail par question, partage |
| Profil | `/profil` | Stats globales, calendrier, historique |
| Détail d'un jour passé | `/profil/AAAA-MM-JJ` | Les 10 questions, ta réponse, la bonne réponse, ton score |
| Connexion | `/connexion` | E-mail + lien magique |
| À propos | `/a-propos` | Principe, crédits des images, contact |
| Admin | `/admin` | Ajout / import de questions (protégé) |

### Détails du profil

- **En-tête** : pseudo, jours joués, score moyen, streak actuelle et record.
- **Calendrier** type heatmap : chaque jour joué est coloré selon le score du jour. Un clic ouvre le détail.
- **Statistiques globales** : score moyen global, évolution sur 30 jours (courbe), meilleur et pire jour, taux de bonnes réponses sur les questions binaires/QCM, précision moyenne sur les questions numériques.
- **Statistiques par catégorie** : score moyen par catégorie (graphique radar ou barres), meilleures et pires catégories.
- **Revue des erreurs** : liste filtrable de toutes les questions passées (par catégorie, par score, par date) avec ta réponse et la bonne réponse.

---

## 9. Comptes et données utilisateur

- **Authentification : Firebase Authentication.** L'API vérifie le jeton Firebase envoyé dans l'en-tête `Authorization: Bearer`.
- **Mode invité** (par défaut) : le front ouvre automatiquement une session anonyme Firebase. Les réponses sont enregistrées sous cet identifiant (`uid`).
- **Compte** : lien magique par e-mail (Firebase), sans mot de passe. Le compte est rattaché à la session anonyme (même `uid`), donc l'historique invité est conservé sans migration. Pseudo modifiable et unique.
- **En local** : l'émulateur Firebase Auth remplace le vrai service. Les liens magiques s'affichent dans la console de l'émulateur, aucun e-mail n'est envoyé.
- **RGPD** : page de politique de confidentialité simple, suppression du compte et de toutes ses données depuis le profil.
- **Pas de données inutiles** : e-mail, pseudo, historique des réponses.

---

## 10. Modèle de données (proposition)

**questions**

- `id`, `type` (binary | mcq | numeric | short\_text)
- `category`, `tags[]`, `difficulty` (1–3)
- `prompt` (texte), `image_url` (nullable), `image_credit` (nullable), `image_alt` (nullable)
- `choices[]` (pour mcq), `correct_answer`
- `numeric_config` : `{ scale: 'linear'|'log', tolerance, factor, unit, exact_margin }`
- `accepted_aliases[]` (pour short\_text)
- `explanation`, `source_url`
- `status` (draft | published | retired), `created_at`

Les données sont des **documents Firestore**. Le navigateur n'y accède jamais directement : `firestore.rules` refuse toute lecture et écriture côté client, et seule l'API Python (SDK Admin) lit et écrit.

| Collection ou chemin | Contenu |
| --- | --- |
| `questions/{id}` | Les champs décrits ci-dessus. L'API ne renvoie jamais `correct_answer` avant la validation d'une réponse |
| `daily_quizzes/{AAAA-MM-JJ}` | `question_ids` (10), générés de façon déterministe puis figés à la première demande du jour |
| `users/{uid}` | `username`, `created_at`, `is_anonymous`, et des statistiques agrégées : `days_played`, `score_sum`, `current_streak`, `best_streak`, `category_stats` (somme et nombre par catégorie), `pillar_stats` |
| `users/{uid}/attempts/{AAAA-MM-JJ}` | `score_total`, `completed_at`, `answers` : liste de 10 objets `{question_id, position, user_answer, score, answered_at}` |
| `reports/{id}` | Signalements : `question_id`, `uid`, `reason`, `created_at` |

Règles de conception :

- L'identifiant du document de participation est la date : une participation par jour et par joueur, garantie par une transaction Firestore.
- Les 10 réponses sont intégrées dans le document de participation : un seul accès pour afficher une journée.
- Les statistiques du profil sont mises à jour dans la même transaction que la réponse validée, pour ne pas tout relire.
- Le `uid` est celui de Firebase Auth. Passer d'une session anonyme à un compte conserve le même `uid`.
- Aucun index composite en V1 : les filtres du profil portent sur les participations d'un seul utilisateur.
- Les scores sont calculés côté serveur (Python), jamais côté navigateur.

Prévu pour plus tard (non créé en V1) : `friendships`, `challenges`, `badges`.

**API FastAPI** (préfixe `/api`) :

| Route | Rôle |
| --- | --- |
| `GET /api/health` | Vérifie que l'API répond |
| `GET /api/today` | Les 10 questions du jour (sans réponses) et l'état de la participation |
| `POST /api/answer` | Valide une réponse, calcule le score, renvoie score, bonne réponse et explication |
| `GET /api/results/{date}` | Détail d'une journée terminée |
| `GET /api/profile` | Statistiques globales et par catégorie, séries |
| `GET /api/profile/days` | Journées jouées avec leur score |
| `POST /api/report` | Signaler une question |
| `DELETE /api/account` | Supprime le compte et toutes ses données |
| `POST /api/admin/questions/import` | Importe des questions (admin) |
| `PATCH /api/admin/questions/{id}` | Change le statut d'une question (admin) |
| `POST /api/dev/...` | Outils de développement (connexion démo, rejouer le jour, historique fictif), actifs uniquement si `APP_ENV=local` |

---

## 11. Choix techniques recommandés

Stack imposée par le porteur du projet : backend Python, frontend React, authentification Firebase, base Firestore, infrastructure Modal, réseau Cloudflare.

- **Backend** : Python 3.12, FastAPI, Pydantic, environnement géré avec `uv`. La logique métier (scoring, quiz du jour, statistiques) vit dans des modules purs, sans dépendance à Firebase, testés avec `pytest`.
- **Frontend** : React 18 + TypeScript, Vite, React Router, Tailwind CSS, TanStack Query pour les appels à l'API. Une page web, pas une application mobile.
- **Authentification** : Firebase Authentication. Session anonyme automatique à l'arrivée, puis lien magique par e-mail pour créer un compte (même `uid`). Le front envoie le jeton à l'API, qui le vérifie avec le SDK Admin.
- **Base de données** : Firestore (documents), accessible uniquement par l'API (voir section 10).
- **Infrastructure** : Modal héberge l'API FastAPI (point d'entrée `modal_app.py`, application ASGI). Les clés Firebase sont des secrets Modal. Aucun serveur à gérer.
- **Réseau** : Cloudflare gère le domaine (DNS), héberge le front (Cloudflare Pages) et proxifie `/api/*` vers l'API Modal avec un Worker, ce qui évite aussi les problèmes de CORS. Il ajoute une limitation de débit sur la route de réponse. En local, le proxy de Vite joue ce rôle.
- **Développement local** : émulateurs Firebase (Auth et Firestore) avec le projet fictif `demo-cervo-daily`, sans compte ni identifiant réel. Les données des émulateurs sont conservées entre deux lancements.
- **Graphiques** : SVG maison ou Recharts.
- **Tests** : `pytest` pour l'API, Vitest pour le front, Playwright pour les parcours de bout en bout.
- **Images** : fichiers libres de droits dans `web/public/questions/`, crédit enregistré dans la question. À défaut, illustrations SVG.
- **Admin** : page `/admin` réservée aux e-mails listés dans `ADMIN_EMAILS`, vérifiés côté API.
- **Configuration** : un seul `.env.local` à la racine, créé depuis `.env.example`, avec des valeurs qui marchent en local.
- **Documentation** : `README.md` en français.

La stack est imposée et ne change pas. Claude Code choisit librement les bibliothèques secondaires (composants, graphiques, tests) et note ses choix dans `DECISIONS.md`.

---

## 12. Banque de questions

### Format d'import (JSON)

```json
{
  "type": "numeric",
  "category": "estimation",
  "tags": ["japon", "architecture"],
  "difficulty": 2,
  "prompt": "Quelle est la hauteur de cette tour en mètres ?",
  "image_url": "...",
  "image_credit": "Auteur / licence",
  "correct_answer": 634,
  "numeric_config": { "scale": "log", "factor": 3, "unit": "m" },
  "explanation": "La Tokyo Skytree mesure 634 m."
}
```

### Exemples pour amorcer (Claude Code doit les vérifier et en produire beaucoup d'autres)

| Type | Catégorie | Question | Réponse |
| --- | --- | --- | --- |
| Numérique (log) | Estimation | Hauteur de la Tokyo Skytree (photo) | 634 m |
| Numérique (log) | Estimation | Hauteur du Burj Khalifa (photo) | 828 m |
| Numérique (log) | Géographie | Distance Terre–Lune en km | environ 384 400 km |
| Numérique (linéaire, tolérance 50) | Histoire | En quelle année est tombé le mur de Berlin ? | 1989 |
| Numérique (log) | Sciences | Combien d'os compte le squelette d'un adulte ? | 206 |
| Vrai/faux | Nature et animaux | La pieuvre a trois cœurs. | Vrai |
| Vrai/faux | Géographie | Sydney est la capitale de l'Australie. | Faux (Canberra) |
| Vrai/faux | Sciences | Le Soleil est une étoile. | Vrai |
| QCM | Culture générale | Capitale du Canada ? (Toronto, Ottawa, Montréal, Vancouver) | Ottawa |
| Suite logique | Logique | 2, 6, 18, 54, ? | 162 |

### Production de la banque

- Claude Code génère un **premier lot d'au moins 300 questions** réparties sur toutes les catégories, **chaque réponse accompagnée d'une explication et d'une source**.
- Marquer ce lot comme `draft` par défaut ; un script `npm run questions:check` valide le format, détecte les doublons et les réponses incohérentes.
- Pour les photos : n'utiliser que des images libres de droits (Wikimedia Commons, Unsplash) avec crédit ; ne jamais copier d'images protégées.
- Le porteur du projet relira et publiera les questions via l'admin. **Prévoir un champ « question signalée »** : un joueur peut signaler une question erronée.

---

## 13. Exigences non fonctionnelles

- **Performance** : première page affichée en moins de 2 s sur 4G. Images optimisées (formats modernes, tailles responsives, lazy loading sauf la première).
- **Accessibilité** : navigation clavier, contrastes suffisants, texte alternatif sur toutes les images, taille de police ajustable.
- **Responsive** : testé de 360 px à 1440 px de large.
- **Sécurité** : scores calculés côté serveur, bonne réponse non exposée avant validation, limitation du débit sur les routes de réponse, validation de toutes les entrées.
- **SEO de base** : titre, description, Open Graph (aperçu de partage) sur l'accueil et les résultats.
- **Analytics** : un outil respectueux de la vie privée (Plausible ou équivalent), optionnel en V1.

---

## 14. Nom et nom de domaine

Critères : court, mémorable, prononçable en français, évoque le rituel quotidien, domaine disponible.

**Propositions** (aucune disponibilité n'a été vérifiée ; à tester chez un registrar avant d'acheter) :

1. **Dizaine** — évoque les 10 questions du jour. Domaines à tester : `dizaine.fr`, `dizaine.app`, `jouerdizaine.com`.
2. **Décade** — idem, plus élégant. Domaines : `decade.fr`, `decade.quiz`.
3. **Les Dix du Jour** — très descriptif. Domaines : `lesdixdujour.fr`.
4. **Cervo** — nom court inventé, évoque le cerveau. Domaines : `cervo.fr`, `cervo.app`.
5. **Quotidix** — quotidien + dix. Domaines : `quotidix.fr`, `quotidix.com`.

**Nom retenu : Vif** (anciennement « Cervo Daily »). Il évoque un esprit affûté, vif et précis. Domaines à tester : `vif.fr`, `jouevif.fr`, `vif.app`. Prendre le `.fr` et si possible le `.com`. Le nom dans le code est `APP_NAME = "Vif"`, changeable en une ligne.

À faire côté porteur du projet (pas côté code) : acheter le domaine (par exemple via Cloudflare, qui gérera aussi le DNS), puis vérifier que le nom n'est pas déjà une marque déposée (base INPI / EUIPO).

---

## 15. Plan d'itérations

**Itération 1 — Socle et logique métier**

- Dépôt avec les dossiers `api/` (Python) et `web/` (React). `npm run start:local` lance les émulateurs Firebase, l'API FastAPI et le front, et affiche une page connectée à `/api/health`.
- Modules `scoring` et `daily` en Python avec tests `pytest` complets (cas limites : réponse nulle, négative, exacte, très éloignée ; même date = même quiz).
- Schéma Firestore, règles de sécurité, script de chargement de 30 questions.

**Itération 2 — Jouer**

- Accueil, parcours des 10 questions, feedback, écran de résultats, branchés sur l'API.
- Session anonyme Firebase automatique, reprise du quiz en cours (état enregistré dans Firestore).
- Une seule participation par jour (identifiant du document = date).

**Itération 3 — Comptes et profil**

- Lien magique Firebase (visible dans l'émulateur en local), rattachement de la session anonyme au compte, pseudo.
- Page profil : stats, calendrier, historique, revue des questions passées.

**Itération 4 — Contenu et admin**

- Admin protégé : import JSON/CSV, formulaire, aperçu, publication.
- Génération de la banque de 300 questions + script de validation.
- Signalement de question.

**Itération 5 — Finitions**

- Partage du résultat, Open Graph, mode sombre, accessibilité, performances.
- Tests de bout en bout, documentation finale.

À la fin de **chaque** itération : lancer les tests, corriger, faire un résumé court et lister ce qui est fait et à faire.

---

## 16. Critères d'acceptation de la V1

- [ ] Un visiteur sans compte peut jouer le quiz du jour et voir son score en moins de 5 minutes.
- [ ] Le même jour, deux visiteurs différents voient les mêmes 10 questions.
- [ ] Un joueur ne peut pas rejouer le quiz du jour une deuxième fois.
- [ ] Le score de chaque question est entre 0 et 100 et correspond aux formules de la section 5 (vérifié par tests).
- [ ] La bonne réponse n'est jamais visible dans les données envoyées au navigateur avant la validation.
- [ ] Le profil affiche l'historique, la streak, les stats globales et par catégorie, et permet de revoir chaque question passée.
- [ ] Un compte peut être créé par lien magique Firebase, et l'historique de la session anonyme est conservé.
- [ ] L'admin permet d'importer des questions et de les publier.
- [ ] La banque contient au moins 120 questions publiées (cible : 300), chacune avec explication.
- [ ] Le site est utilisable sur mobile (360 px) et desktop.
- [ ] Depuis un clone propre du dépôt, la commande npm run start:local suffit pour jouer sur http://localhost:5173 avec les questions chargées, sans compte Firebase, Modal ni Cloudflare.
- [ ] Tous les tests passent.

---

## 17. Feuille de route après la V1 (pour mémoire)

1. **Amis** : ajout par pseudo ou lien d'invitation, comparaison des scores du jour, classement entre amis.
2. **Défis** : défier un ami sur un set précis.
3. **Badges et séries** : récompenses, paliers de streak.
4. **Nouveaux types de questions** : classement, carte, audio.
5. **Mode entraînement** par catégorie.
6. **Rappels** par e-mail.
7. **Monétisation éventuelle** : version premium sans publicité, statistiques avancées.

---

## 18. Points ouverts à trancher par le porteur du projet

- Nom définitif et domaine.
- Y a-t-il des catégories à ajouter ou retirer ?
- Les 10 questions doivent-elles être strictement les mêmes pour tout le monde (recommandé) ?
- Souhaite-t-on un chrono optionnel plus tard ?
- Qui relit et publie les questions au quotidien ?
