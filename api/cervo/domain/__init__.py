"""Règles métier pures : aucune entrée/sortie, aucune dépendance à Firebase.

- `catalog` : référentiels (catégories, piliers, formats, chrono).
- `models`  : format d'une question et des requêtes (validation Pydantic).
- `scoring` : score de 0 à 100 d'une réponse, pour chaque type de question.
- `daily`   : composition déterministe du quiz du jour.
- `stats`   : agrégats du profil joueur (séries, catégories, piliers).

Tout ce qui est ici se teste sans émulateur (voir api/tests/test_*.py).
"""
