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
- **Chargement des questions** au démarrage, avant l'API, seulement si la collection `questions` est vide. `db:reset` force le rechargement.
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
- **Contraintes** (section 7 + vision) : 1 image, 2 numériques, 4 questions « réflexion » (Raisonnement/Estimation/Esprit critique), 4/4/2 en difficulté, ≥ 5 catégories, ≤ 3 par catégorie. Assouplissement dans l'ordre : difficulté, puis catégories (avec numériques et piliers), puis images.
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
- **Partage** : texte à emojis copié dans le presse-papiers (partage natif sur mobile), sans dévoiler les questions.
- **Import CSV** : colonnes listées dans l'admin, listes séparées par « | », séparateur « , » ou « ; » détecté automatiquement (Excel français).
- **Limitation de débit** : simple compteur en mémoire dans l'API (40 réponses/minute par joueur) ; en production, Cloudflare ajoute sa propre règle.

## Contenu

- **350 questions** écrites pour le MVP (cible : 300), chacune avec explication ; la plupart avec une source Wikipédia ou Insee. Les énigmes de logique pure n'ont pas de source (la preuve est dans l'explication). À relire par le porteur du projet.
- **Images** : 52 illustrations SVG originales générées par script (comptage de points, angles, proportions, drapeaux, silhouettes de monuments). Aucun problème de droits ; elles portent la mention « Illustration ». Les silhouettes ne sont pas à l'échelle exacte.
- **Fuseau horaire** : `Europe/Paris`, réglable avec `TIMEZONE`.

## Hors périmètre préparé

- Le modèle de données laisse la place à `friendships`, `challenges`, `badges` (non créés).
- `modal_app.py` et `infra/cloudflare/` permettent la mise en ligne, non testée dans le MVP (aucun compte).
