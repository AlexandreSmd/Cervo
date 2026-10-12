# Décisions techniques

Décisions prises pendant le développement du MVP, quand PRODUCT.md laissait le choix ou posait problème.

## Dépôt et environnement

- **Dépôt GitHub** : le développement a été fait dans un environnement cloud où `gh` n'était pas connecté et où le dépôt `AlexandreSmd/Cervo` existait déjà. Le code est donc poussé sur ce dépôt (branche `claude/exciting-allen-i6uklp`) au lieu de créer `cervo-daily`. Pour le renommer : GitHub › Settings › Repository name.
- **npm workspaces** : le `package.json` racine orchestre, `web/` est un workspace. Un seul `npm install` installe tout (y compris `firebase-tools`, en local au projet, rien d'installé globalement).
- **Scripts en Node** (`scripts/*.mjs`), sans bash : ils marchent sur macOS, Linux et Windows. `setup` ne relance `npm install` que si un `package.json` a changé.
- **Python géré par uv** : `requires-python >= 3.12` ; uv télécharge Python s'il manque.

## Données et Firebase

- **Projet fictif `demo-cervo-daily`** : le préfixe `demo-` dit aux émulateurs qu'aucune ressource réelle n'existe, donc pas de connexion Google nécessaire.
- **Questions publiées par défaut** (`status: published`) : la section « Livraison du MVP » prime sur la section 12 (qui proposait `draft`). L'admin permet de retirer ou repasser en brouillon.
- **Chargement des questions** au démarrage, avant l'API : les questions absentes de Firestore sont ajoutées (les nouvelles questions arrivent sans perdre l'historique) ; celles déjà présentes ne sont pas réécrites, pour garder les changements faits dans l'admin. `db:reset` repart de zéro.
- **Dates stockées en texte ISO** (`2026-10-10T08:00:00+00:00`) plutôt qu'en Timestamp Firestore : plus simple à sérialiser, triable.
- **Pseudos uniques** via une collection `usernames/{pseudo en minuscules}` mise à jour en transaction. Pseudo par défaut : `Cervo-XXXXX`.
- **Réponses dénormalisées** : chaque réponse stockée garde `category` et `type` pour calculer les tendances par pilier sans relire les questions.
- **Tests d'intégration** : ils utilisent une base Firestore séparée (`FIRESTORE_PROJECT_ID=demo-cervo-test`) pour ne jamais toucher aux données de dev, même si `npm run dev` tourne. Si les émulateurs ne tournent pas, `npm test` les démarre temporairement (`firebase emulators:exec`).

## Scoring

- **Règle « à moins de 1 % = 100 » appliquée seulement à l'échelle log.** En échelle linéaire (années), 1 % de 1989 ferait ±20 ans de marge, ce qui viderait la question de son sens. En linéaire, seul `exact_margin` (par question) donne 100.
- **Tolérance linéaire par défaut** : 10 % de la valeur (minimum 1) si la question n'en précise pas.
- **Arrondi** : demi vers le haut (`78,5 → 79`), pas l'arrondi bancaire de Python.
- **Réponses courtes numériques** (suites logiques) : comparaison exacte du nombre (« 162 », « 162,0 »). Réponses textuelles : casse, accents, espaces et ponctuation ignorés, plus les alias.
- **Saisie numérique** : « 384 400 », « 3,5 », « 1e3 » acceptés.

## Quiz du jour

- **Déterministe** : graine = SHA-256 de la date, la banque est triée par identifiant. Même date + même banque + même historique = même quiz. Le résultat est figé dans `daily_quizzes/{date}` à la première demande (création atomique, `create()`).
- **Pas de répétition** : on exclut les questions des jours précédents (jusqu'à 365 jours) tant qu'il reste au moins 40 questions disponibles ; au-delà, les plus anciennes redeviennent éligibles. Avec 350 questions, aucune répétition pendant environ 31 jours.
- **Contraintes** (section 7 + vision) : 1 image, 2 numériques, 4 questions « réflexion » (Raisonnement/Estimation/Esprit critique), ≥ 5 catégories, ≤ 3 par catégorie. Assouplissement dans l'ordre : difficulté, puis catégories (avec numériques et piliers), puis images.
- **Difficulté relevée (demande du porteur)** : 2 faciles / 4 moyennes / 4 difficiles par jour (au lieu de 4/4/2 dans PRODUCT.md), et 118 questions ajoutées dont 83 difficiles (fichiers `content/questions/*-difficile.json`). La banque compte 468 questions dont 138 difficiles : un mois complet sans répétition, vérifié par un test.
- **Ordre des questions** : de la plus facile à la plus difficile, pour un démarrage en douceur.
- **On ne répond qu'au quiz du jour** : une réponse envoyée avec une autre date est refusée (évite de jouer « hier » après minuit).
- **Les catégories Géographie et Sciences comptent dans le pilier Estimation**, comme le tableau des piliers de PRODUCT.md.

## Comptes

- **Session invité automatique** (Firebase anonyme) dès l'arrivée.
- **Lien magique** : `linkWithCredential` rattache l'e-mail à la session invité (même `uid`, historique conservé). Si l'e-mail a déjà un compte, on se connecte à ce compte : l'historique invité de l'appareil n'est alors pas fusionné (cas rare, fusion prévue plus tard si besoin).
- **Outils de dev** : connexion démo/admin via jeton personnalisé (`create_custom_token`), routes `/api/dev/*` actives seulement si `APP_ENV=local`.
- **Admin** : vérifié côté API par l'e-mail du jeton (`ADMIN_EMAILS`).

## Front

- **Bibliothèques** : React 18, React Router 6, TanStack Query 5, Tailwind 3, polices Fontsource (servies localement, pas d'appel à Google Fonts), graphiques en SVG maison (pas de dépendance de graphiques).
- **Taille du texte ajustable** (bouton « AA ») et mode sombre, mémorisés dans le navigateur.
- **Partage Messenger (mobile)** : le bouton « Envoyer sur Messenger » ouvre la feuille de partage du téléphone (Web Share API), où Messenger apparaît. Messenger ne permet pas de pré-remplir un message par lien direct (son lien `fb-messenger://share` n'accepte qu'une URL) ; la feuille de partage est donc la seule façon d'envoyer le texte en un geste. Si elle n'est pas disponible (site en http sur le Wi-Fi local), le message est copié et un bouton ouvre l'application Messenger pour le coller.
- **Message partagé** : une ligne par question avec 🟢 (50 points ou plus, soit plus de la moitié) ou 🔴 (moins de 50), le score de chaque question, le score du jour et le lien. Le code couleur à deux couleurs a été demandé par le porteur ; à l'écran, les perles gardent leurs trois couleurs. Les questions ne sont jamais dévoilées. `VITE_PUBLIC_URL` permet de mettre l'adresse publique du site dans le message.
- **Test sur téléphone en local** : Vite et l'émulateur Auth écoutent sur le réseau local ; `npm run dev` affiche l'adresse à ouvrir sur le téléphone (même Wi-Fi). L'API et Firestore restent accessibles uniquement depuis l'ordinateur.
- **Import CSV** : colonnes listées dans l'admin, listes séparées par « | », séparateur « , » ou « ; » détecté automatiquement (Excel français).
- **Limitation de débit** : simple compteur en mémoire dans l'API (40 réponses/minute par joueur) ; en production, Cloudflare ajoute sa propre règle.

## Contenu

- **350 questions** écrites pour le MVP (cible : 300), chacune avec explication ; la plupart avec une source Wikipédia ou Insee. Les énigmes de logique pure n'ont pas de source (la preuve est dans l'explication). À relire par le porteur du projet.
- **Images** : 52 illustrations SVG originales générées par script (comptage de points, angles, proportions, drapeaux, silhouettes de monuments). Aucun problème de droits ; elles portent la mention « Illustration ». Les silhouettes ne sont pas à l'échelle exacte.
- **Fuseau horaire** : `Europe/Paris`, réglable avec `TIMEZONE`.

## Hors périmètre préparé

- Le modèle de données laisse la place à `friendships`, `challenges`, `badges` (non créés).
- `modal_app.py` et `infra/cloudflare/` permettent la mise en ligne, non testée dans le MVP (aucun compte).

## Espace fondateur (version 2)

- **Quiz du jour planifié** : `daily_quizzes/{date}` est maintenant écrit à l'avance depuis le planning. Un jour non planifié reste calculé automatiquement à la première visite après minuit (heure de Paris), puis figé : le site se met à jour seul même si personne ne planifie. Même questions, même ordre pour tout le monde.
- **Verrouillage** : un jour passé, ou aujourd'hui dès qu'un joueur a commencé, ne se modifie plus (sinon les réponses déjà données ne correspondraient plus).
- **Pas de doublon proche** : la sélection automatique évite les questions des autres jours planifiés, passés comme futurs, en partant des plus proches. Le planning signale les écarts aux règles (difficulté 2/4/4, catégories, photo, nombres) sans les imposer : le fondateur garde la main.
- **Glisser-déposer natif** (HTML5, sans bibliothèque) ; sur mobile ou au clavier, le panneau d'une question propose « Avant », « Après » et « Remplacer par ».
- **Statistiques** : agrégats `daily_stats/{date}` (joueurs, terminés, somme des scores, répartition par tranche de 10, réussite par question) et `question_stats/{id}`, mis à jour dans la transaction de chaque réponse. Le tableau de bord lit quelques documents au lieu de toutes les participations.
- **Structure d'une question** : `images` (0 à 2) remplace `image_url`/`image_alt`/`image_credit` ; l'ancien format reste accepté à l'import et à la lecture. Le format d'entrée est déduit du nombre de photos ; le format de réponse est le champ `type`.
- **Photos envoyées depuis l'admin** : réduites dans le navigateur (1 200 px, JPEG), stockées dans Firestore (`media/{id}`, 900 Ko maximum) et servies par `/api/media/{id}` avec un cache long. Pas de service de stockage en plus à configurer ; à remplacer par Firebase Storage si les volumes grossissent.
- **Photos de personnes réelles** : aucune n'est fournie (droits à l'image). Le modèle « Reconnaître une personne » est prêt : il suffit d'envoyer une photo libre de droits (Wikimedia Commons) avec son crédit.
- **Interface joueur épurée** : onglets en bas sur mobile, gros chiffres, presque pas de texte ; plus d'écran d'introduction (une étiquette « Sans aide » sur la première question), plus de pied de page, plus de boutons de taille de texte et de thème (le thème suit le téléphone). La page À propos est supprimée ; la confidentialité est accessible depuis le profil. Les outils de dev sont passés dans l'espace fondateur.
- **Horaire** : le changement de jour se fait à minuit à Paris (heure d'Europe centrale, CET/CEST), réglable avec `TIMEZONE`.

## Types de questions et chrono (version 3)

- **Chrono de 15 secondes** (demande du porteur, à la place du « pas de chrono » de PRODUCT.md). Il démarre côté serveur quand la question s'affiche (`POST /api/question-start`) : recharger la page ne le remet pas à zéro. Une réponse arrivée après le temps imparti + 4 s de marge (réseau) vaut 0. Le temps est plus long pour une dictée (45 s) et un classement (20 s) ; il est réglable question par question. La phase de mémorisation ne compte pas dans le chrono.
- **Dictée** : lue par la synthèse vocale du navigateur (`speechSynthesis`, voix française, lecture normale ou lente, réécoute illimitée) : pas de fichier audio à produire. Le texte doit donc être envoyé au navigateur ; il est encodé (base64) pour ne pas s'afficher en clair. Score : part des mots justes (distance d'édition sur les mots), accents comptés, majuscules et ponctuation ignorées. Extraits d'auteurs du domaine public uniquement.
- **Taille (façon Size It Up)** : l'objet de référence est fixe, le joueur agrandit ou rétrécit l'autre avec un curseur logarithmique. Les objets sont des emojis (aucune image à fournir). Score en proportion : 100 à moins de 1 %, 0 à un facteur 2.
- **Remettre dans l'ordre** : on touche les éléments dans l'ordre (plus fiable sur téléphone qu'un glisser-déposer). Points partiels : part des paires dans le bon ordre relatif.
- **Curseur** : option des questions « nombre » (frise chronologique, pourcentages), bornée par min et max.
- **Mémoire flash** : option de n'importe quelle question : une liste de mots ou une photo s'affiche quelques secondes, puis disparaît avant la question.
- **QCM sensibles aux accents** : nécessaire pour les questions d'orthographe (« Hypothèse » ≠ « Hypothése »).
- **Quiz du jour** : au plus 1 dictée, 2 classements et 2 questions de taille par jour, pour garder un rythme rapide.
- **Écran de réponse** : un bandeau de couleur avec le verdict (Bravo, Pas loin, Raté, Temps écoulé) et les points gagnés, puis la bonne réponse en gros, ta réponse en petit, et l'explication. Pour un classement, l'ordre attendu avec ✓ ou ✗ par ligne.
- **Admin** : « Pas encore posées » (jamais jouées, y compris celles planifiées pour plus tard) et « Déjà posées » (jouées au moins une fois, aujourd'hui compris).
- **Nouvelles catégories** : Langue française (dictées, orthographe, anagrammes) et Mémoire, rattachées au pilier Mémoire et culture.

## Socle de code (version 4)

- **API en trois couches** : `domain/` (règles pures, testées sans base), `services/` (cas d'usage Firestore), `web/` (routes fines). Les dépendances vont toujours `web → services → domain`. Détails dans `docs/ARCHITECTURE.md`.
- **Noms des collections centralisés** (`services/collections.py`), erreurs métier (`errors.ApiError`) et dates (`clock.py`) en un seul endroit.
- **Validation par format de réponse** : une fonction de contrôle par type (`models._ANSWER_CHECKS`) et un `match` dans `scoring.score_answer` : ajouter un type se fait au même endroit, sans chaîne de `if`.
- **Qualité automatisée** : Ruff (Python), ESLint + Prettier + TypeScript strict (interface), `npm run check` avant chaque commit, CI GitHub (qualité, tests, build, puis parcours Playwright avec les émulateurs).
- **Planning lisible** : une ligne par question avec l'énoncé complet, la réponse attendue, la catégorie, la difficulté et le format ; une frise de dates (prêt, alerte, vide, joué) pour naviguer ; les alertes affichées directement. La logique du glisser-déposer est isolée dans `admin/planningLogic.ts` et testée.

## Nom : Vif

- Le produit s'appelle **Vif** (après « Cervo Daily », « Aiguisé » puis « Sharp Mind ») (mission : « Garder son esprit affûté, vif et précis. »). Le nom affiché vient de `APP_NAME` (`web/src/lib/config.ts` et `api/cervo/__init__.py`), la promesse de `BASELINE` et `MISSION`.
- Les **identifiants techniques restent `cervo`** (paquet Python `cervo`, projet d'émulateur `demo-cervo-daily`, comptes de test `@cervo.test`) : invisibles pour les joueurs, et les renommer casserait les données locales existantes sans rien apporter. À changer seulement au moment de créer le vrai projet Firebase.
- Pseudo par défaut des nouveaux joueurs : `Vif-XXXXX`.

## Production (version 5)

- **Hébergement** : site et aiguillage `/api` sur un Worker Cloudflare (fichiers statiques + proxy, même domaine, pas de CORS) ; API sur Modal (`modal_app.py`, conteneurs à la demande, gratuit dans le crédit mensuel) ; Firebase Auth et Firestore (offre gratuite Spark). Tout se déploie avec `npm run prod:deploy` (`scripts/prod.mjs`), qui vérifie d'abord la configuration (`prod:check`).
- **Secrets** : la clé du compte de service Firebase reste dans `secrets/firebase-admin.json` (ignoré par Git) et n'est envoyée qu'au secret Modal `vif-prod`. La configuration Web Firebase (`.env.production`) n'est pas secrète : elle est publique par conception.
- **Admin** : `ADMIN_EMAILS` (ton adresse) et e-mail vérifié obligatoire. Les routes `/api/dev/*` répondent 404 hors local. En production, l'API ne lit jamais `.env.local`.
- **Connexion** : invité automatique, puis « Continuer avec Google » ou lien magique par e-mail ; dans les deux cas le compte est rattaché à la session invité (historique conservé).
- **Quota Firestore** : la banque de questions est gardée en mémoire et rechargée seulement quand `meta/bank.version` change (incrémentée à chaque modification) : une lecture toutes les 30 s par serveur au lieu de plusieurs centaines.
- **Domaine** : les `.com` s'achètent chez Cloudflare (déjà branchés) ; les `.fr` chez OVH, puis serveurs DNS pointés vers Cloudflare.
- **Réveil de l'API** : voir « Performance mobile » ci-dessous (un conteneur gardé allumé par défaut).

## Performance mobile (version 6)

Constat après la mise en ligne : sur téléphone, écrans lents ou qui ne se chargent pas.

- **API toujours chaude** : `API_WARM_CONTAINERS=1` par défaut (`.env.production`), environ 5 $ par mois, couverts par les 30 $ de crédit Modal. Un serveur neuf se préchauffe en tâche de fond dès son démarrage : connexion Firestore, banque de questions, quiz du jour (`api/cervo/warmup.py`). `0` reste possible (gratuit, 3 à 6 s d'attente après une pause).
- **Moins d'allers-retours vers Firestore** (le serveur Modal et la base ne sont pas sur le même continent : chaque aller-retour compte) :
  - `/today` lit le profil et la participation en une seule lecture groupée (`get_all`) ;
  - les 10 questions du jour sont gardées 30 s en mémoire, et le cache est vidé dès qu'une modification du planning passe par ce serveur ;
  - `/answer` ne relit plus le profil avant la transaction : le profil est créé dans la transaction s'il manque ;
  - `/question-start` ne touche plus au profil.
- **Session Firebase fiable sur mobile** : `initializeAuth` avec la session gardée d'abord dans localStorage. IndexedDB peut rester bloqué dans les navigateurs intégrés (Messenger, Instagram) ; il ne sert plus qu'à récupérer les sessions déjà enregistrées, qui sont migrées automatiquement. Le module popup de Google (et son iframe) n'est chargé qu'au clic sur « Continuer avec Google ».
- **Jamais de chargement sans fin** :
  - au-delà de 12 s sans session, message avec « Réessayer » ;
  - requêtes limitées à 20 s ;
  - 2 nouvelles tentatives automatiques, seulement sur les erreurs réseau ou serveur.
- **Affichage instantané** :
  - écran de démarrage dans `index.html`, avant même le JavaScript ;
  - dernières données de l'accueil et du profil gardées sur l'appareil (`lib/cache.ts`), affichées tout de suite puis remplacées par les fraîches ;
  - le jeu lui-même attend toujours les données du serveur ;
  - l'accueil se met à jour au retour dans l'appli (nouveau quiz à minuit).
- **Moins à télécharger** :
  - espace fondateur et page de connexion chargés à la demande, jamais pour un joueur ;
  - React et Firebase dans des fichiers séparés ;
  - les fichiers `/assets/*` (nom à empreinte) sont mis en cache un an, la page est toujours revalidée.
- **Messenger** : la page de connexion explique que Google y bloque la connexion et propose d'ouvrir le site dans Safari ou Chrome, ou de recevoir un lien par e-mail.

## Les 10 types de question (version 7)

La philosophie : des questions **intéressantes à jouer**, pas seulement de la culture générale.

- **Une question de chaque type par jour, toujours dans le même ordre** : 📖 Vocabulaire, 📏 Taille, 💡 Fait étonnant, 🧠 Mémoire, 📊 Statistique, ⏳ Chronologie, ⚖️ Estimation, 🕵️ Devinette, 🧩 Énigme, ✍️ Dictée.
  - L'ordre est pensé pour le rythme : un échauffement rapide, puis une alternance de mécaniques (toucher, glisser, taper) et de rythmes.
  - Le gros effort de réflexion arrive en 9ᵉ position, et la dictée, sans chrono, permet de finir au calme.
  - C'est un ordre de jeu, pas l'ordre de la liste d'origine.
- **Modèle** : le champ `category` porte le type (référentiel `domain/catalog.KINDS`), le champ `type` la mécanique de réponse, contrainte par le type. Trois mécaniques nouvelles :
  - `recall` : réécrire une liste mémorisée ;
  - `percent` : pourcentage, scoré en points d'écart ;
  - `riddle` : devinette à indices.
- **Chrono intelligent** (`domain/timing.py`) :
  - une base par type et par difficulté (de 12 s pour le vocabulaire facile à 90 s pour l'énigme difficile) ;
  - plus le temps de lecture : environ 3 mots par seconde au-delà de 15 mots, choix de QCM compris ;
  - plus 3 s par photo, 4 s par élément à classer au-delà de 4, 2 s par élément à réécrire ;
  - arrondi aux 5 s ;
  - la durée de mémorisation dépend du nombre d'éléments et de la difficulté ;
  - la dictée se joue sans chrono.
- **Propre à chaque type** :
  - **Dictée** :
    - écoute complète ou phrase par phrase, réécoute illimitée, vitesse lente, normale ou rapide ;
    - correction mot à mot : la faute en rouge à côté de ce qui a été tapé, les mots oubliés en orange.
  - **Devinette** :
    - les indices restent sur le serveur et sont dévoilés un à un (`POST /api/clue`), leur nombre est gardé dans la partie ;
    - 100, 75, 50, 30 puis 20 points ;
    - casse, accents et articles ignorés.
  - **Statistique** : grille de 100 points, la réalité en vert après la réponse.
  - **Taille** : les deux objets à leur vraie proportion après la réponse, ta réponse en transparence.
  - **Chronologie** : la date de chaque élément après la réponse.
  - **Mémoire** :
    - grandes tuiles pour les chiffres et les emojis ;
    - réécrire une suite de chiffres d'un bloc (« 7294183 »), avec un compteur.
  - **Fait étonnant** : l'explication est mise en avant (« Le savais-tu ? »).
- **Sélection du jour** :
  - pour chaque type, la question la moins récemment posée (passé et planning compris) ;
  - parmi les plus fraîches, celle qui rapproche la journée de 3 faciles, 4 moyennes et 3 difficiles ;
  - avec 3 questions par type, chacune revient tous les 3 jours, c'est voulu pour démarrer ;
  - un type sans question publiée est remplacé par une question d'un autre type, et le planning le signale.
- **Planning** :
  - une ligne par type, dans l'ordre ; on remplace la question d'un type par une autre du même type (glisser-déposer ou liste), l'ordre ne se change pas ;
  - le serveur refuse une journée sans un type disponible ou avec un doublon ;
  - alertes : type manquant, question reprise à moins de 7 jours, journée trop facile ou trop difficile.
- **Banque** :
  - en haut, la réserve de chaque type : questions, niveaux, tous les combien de jours elles reviennent, bouton + ;
  - l'éditeur commence par le choix du type, puis ne demande que ce que ce type utilise (calculette de rapport pour la taille, dates pour la chronologie, indices pour la devinette, écoute de contrôle pour la dictée), avec l'aperçu téléphone et le chrono calculé.
- **Tableau de bord** : réussite et réserve par type.
- **Profil** :
  - « Tes 10 défis » : la moyenne par type ;
  - la « forme du cerveau » passe à 5 piliers : Logique, Estimation, Mémoire, Langage, Culture ;
  - les anciens piliers des profils sont regroupés dans les nouveaux.
- **Partage** : chaque ligne du message indique aussi le type (« 1. 🟢 100/100  📖 Vocabulaire »).
- **Pendant le quiz**, les onglets du bas sont masqués : toute la place pour la question.
- **Anciennes questions** :
  - au déploiement, `tools/migrate.py` les retire ; elles restent en base pour l'historique des joueurs ;
  - les journées à venir qui en contenaient sont recomposées, une journée déjà commencée n'est jamais touchée ;
  - elles restent visibles en lecture seule dans l'admin (« Anciennes questions »).
- **Contenu de départ** : 30 questions, 3 par type, un niveau de chaque, toutes avec explication (et source pour les faits et les chiffres). Guide d'écriture : `docs/QUESTIONS.md`.
