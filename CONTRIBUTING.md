# Contribuer

1. **Lancer** : `npm run start:local` (voir README).
2. **Avant chaque commit** : `npm run check` (qualité + tests). `npm run format` corrige la mise en forme.
3. **Parcours complets** : `npm run test:e2e` quand l'interface change.
4. **Architecture** : lire `docs/ARCHITECTURE.md` (couches, données, ajout d'un type de question).
5. **Décisions** : noter tout choix non évident dans `DECISIONS.md`.

## Conventions

- Code, commentaires et messages en **français** ; identifiants en anglais.
- Python : Ruff (`api/pyproject.toml`), annotations de type, une docstring par module et par fonction publique.
- TypeScript : ESLint + Prettier (`web/`), `strict`, composants en fonctions, données distantes via TanStack Query.
- Une règle métier se teste sans base de données : elle va dans `api/cervo/domain/`.
- Jamais de secret dans le dépôt ; `.env.local` reste local.
- Commits courts, au présent, qui disent ce qui change.
