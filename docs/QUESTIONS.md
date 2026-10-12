# Écrire des questions pour Vif

Chaque jour, le quiz pose **une question de chacun des 10 types**, toujours dans cet ordre :

| # | Type | Ce que fait le joueur | Chrono (facile / moyen / difficile) |
| --- | --- | --- | --- |
| 1 | 📖 Vocabulaire | Choisit le mot juste parmi 4 | 15 / 15 / 20 s |
| 2 | 📏 Taille | Agrandit ou réduit un objet par rapport à un autre | 15 / 20 / 20 s |
| 3 | 💡 Fait étonnant | Vrai ou faux (ou 4 choix), puis découvre l'explication | 15 / 20 / 20 s |
| 4 | 🧠 Mémoire | Mémorise une liste, puis la réécrit, trouve l'intrus ou la remet dans l'ordre | 15 / 20 / 25 s + 2 s par élément à réécrire |
| 5 | 📊 Statistique | Devine un pourcentage sur 100 personnes | 15 / 20 / 20 s |
| 6 | ⏳ Chronologie | Classe 4 à 5 événements, du plus ancien au plus récent | 20 / 25 / 30 s + 4 s par élément au-delà de 4 |
| 7 | ⚖️ Estimation | Donne un ordre de grandeur (poids, taille, durée…) | 15 / 20 / 25 s |
| 8 | 🕵️ Devinette | Trouve avec le moins d'indices possible | 40 / 45 / 50 s |
| 9 | 🧩 Énigme | Résout un problème de logique | 45 / 60 / 90 s |
| 10 | ✍️ Dictée | Écoute deux phrases et les écrit | sans chrono |

Le chrono est **calculé tout seul** : base du type et de la difficulté, plus le temps de lire
l'énoncé et les choix (environ 3 mots par seconde au-delà de 15 mots), plus 3 s par photo,
arrondi aux 5 secondes. L'éditeur l'affiche ; on peut l'imposer avec `time_limit`.

**Le plus simple : l'éditeur de l'espace fondateur** (Banque → + sur le type voulu). Le
formulaire ne demande que ce que le type utilise et montre l'aperçu sur téléphone. Pour écrire
beaucoup de questions d'un coup, utilise les fichiers `content/questions/<type>.json` (un par
type), puis `npm run questions:check`.

## Ce qui fait une bonne question

- **Intéressante à jouer, pas seulement à savoir** : on doit pouvoir réfléchir, estimer ou
  déduire, même sans connaître la réponse.
- **Une explication qui donne envie de la raconter** (10 caractères minimum, 2 phrases idéales).
- **Une source** (`source_url`) pour tout chiffre ou fait.
- **Une difficulté honnête** : 1 (facile), 2 (moyen), 3 (difficile). Le tirage vise 3 faciles,
  4 moyennes et 3 difficiles par jour : écris de tous les niveaux.
- **De la réserve** : avec N questions d'un type, chacune revient tous les N jours. Vise au
  moins 30 par type (un mois sans répétition).

## Format de chaque type

Champs communs : `id` (facultatif dans l'éditeur), `category` (le type), `type` (la mécanique),
`difficulty`, `prompt`, `explanation`, `source_url`, `status` (`published` ou `draft`),
`images` (0 à 2 photos, facultatif).

### 📖 Vocabulaire (`mcq`)
```json
{ "category": "vocabulaire", "type": "mcq", "difficulty": 2,
  "prompt": "Quel est le contraire de « prolixe » ?",
  "choices": ["Concis", "Prolifique", "Généreux", "Hésitant"], "correct_answer": "Concis",
  "explanation": "Prolixe : qui parle trop longuement. Piège : « prolifique » veut dire « qui produit beaucoup »." }
```

### 📏 Taille (`size`)
`correct_answer` = taille de l'objet à ajuster ÷ taille de la référence. Plein score à 1 % près,
0 point à un facteur 2. Choisis des emojis qui ressemblent vraiment à l'objet.
```json
{ "category": "taille", "type": "size", "difficulty": 3,
  "prompt": "Ajuste la statue de la Liberté par rapport à la tour Eiffel (hauteur).",
  "size_config": { "reference": { "label": "Tour Eiffel", "emoji": "🗼" },
                   "target": { "label": "Statue de la Liberté", "emoji": "🗽" }, "min": 0.05, "max": 2 },
  "correct_answer": 0.28, "explanation": "93 m contre 330 m." }
```

### 💡 Fait étonnant (`binary` ou `mcq`)
```json
{ "category": "fait", "type": "binary", "difficulty": 1,
  "prompt": "Une pieuvre a trois cœurs.", "correct_answer": true,
  "explanation": "Deux cœurs branchiaux et un cœur principal. Et son sang est bleu." }
```

### 🧠 Mémoire (`recall`, `mcq` ou `order`)
`memorize.items` est montré quelques secondes (durée calculée selon le nombre d'éléments et la
difficulté, ou `memorize.seconds`), puis caché.
- `recall` : le joueur réécrit la liste (`correct_answer` = la liste ; `recall_ordered` : l'ordre compte).
- `mcq` : « lequel n'était pas dans la liste ? ».
- `order` : remettre dans l'ordre d'apparition (`correct_answer` = la liste).
```json
{ "category": "memoire", "type": "recall", "difficulty": 2,
  "prompt": "Retape les 7 chiffres, dans l'ordre.",
  "memorize": { "items": ["7", "2", "9", "4", "1", "8", "3"] },
  "correct_answer": ["7", "2", "9", "4", "1", "8", "3"], "recall_ordered": true,
  "explanation": "La mémoire à court terme retient environ 7 éléments." }
```

### 📊 Statistique (`percent`)
Score selon l'écart en points : 100 à 1 point près, 0 à 20 points d'écart (réglable avec
`numeric_config.tolerance`).
```json
{ "category": "stat", "type": "percent", "difficulty": 2,
  "prompt": "Quelle part de la population mondiale est gauchère ?", "correct_answer": 10,
  "explanation": "Environ 10 %, une proportion stable à travers les pays et les époques." }
```

### ⏳ Chronologie (`order`)
`correct_answer` dans le bon ordre (mélangé pour le joueur), `order_details` : la date de chaque
élément, montrée après la réponse. Points partiels selon les paires bien ordonnées.
```json
{ "category": "chronologie", "type": "order", "difficulty": 2,
  "prompt": "Ces objets du quotidien : lequel est apparu en premier ?",
  "correct_answer": ["Le papier", "Les lunettes de vue", "La boîte de conserve", "Le timbre-poste", "Le jean"],
  "order_details": ["vers 105", "vers 1285", "1810", "1840", "1873"],
  "explanation": "…" }
```

### ⚖️ Estimation (`numeric`, échelle log)
`factor` : à quel facteur d'erreur on tombe à 0 point (1,5 strict, 2 normal, 3 large).
```json
{ "category": "estimation", "type": "numeric", "difficulty": 1,
  "prompt": "Combien pèse en moyenne un éléphant d'Afrique mâle adulte ?",
  "correct_answer": 6, "numeric_config": { "scale": "log", "factor": 3, "unit": "tonnes", "exact_margin": 0.5 },
  "explanation": "…" }
```

### 🕵️ Devinette (`riddle`)
3 à 5 indices, du plus vague au plus précis. Le 1er est offert ; la réponse vaut 100, 75, 50,
30 puis 20 points selon les indices vus. Casse, accents et articles (le, la, l'…) sont ignorés ;
`accepted_aliases` pour les autres façons de l'écrire.
```json
{ "category": "devinette", "type": "riddle", "difficulty": 1,
  "prompt": "Quel animal suis-je ?",
  "clues": ["Je dors jusqu'à 20 heures par jour.", "Je ne mange presque que les feuilles d'un seul arbre.",
            "Je vis en Australie.", "On m'appelle parfois « ours », mais je suis un marsupial."],
  "correct_answer": "koala", "accepted_aliases": ["koalas"], "explanation": "…" }
```

### 🧩 Énigme (`mcq` ou `short_text`)
Une réponse numérique en `short_text` doit être exacte (`correct_answer` : un nombre).
```json
{ "category": "enigme", "type": "short_text", "difficulty": 2,
  "prompt": "Une batte et une balle coûtent 1,10 € au total. La batte coûte 1 € de plus que la balle. Combien coûte la balle, en centimes ?",
  "correct_answer": 5, "explanation": "…" }
```

### ✍️ Dictée (`dictation`)
Deux phrases, ponctuées. Lues par la voix du téléphone ; casse et ponctuation ne comptent pas,
les accents si. Score = part des mots justes.
```json
{ "category": "dictee", "type": "dictation", "difficulty": 2,
  "prompt": "Deux phrases, sans faute. Réécoute autant que tu veux.",
  "correct_answer": "Les fleurs que j'ai cueillies hier se sont déjà fanées. Quels que soient tes efforts, elles ne reviendront pas.",
  "explanation": "« Cueillies » s'accorde avec « que »…" }
```
