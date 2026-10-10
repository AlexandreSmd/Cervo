"""Cas d'usage qui lisent et écrivent dans Firestore.

Chaque fonction reçoit le client Firestore (`db`) en premier argument : pas d'état global
caché, et les tests d'intégration peuvent viser une base séparée.

- `collections` : noms des collections (une seule source de vérité).
- `bank`        : banque de questions (fichiers JSON, cache, vues publiques).
- `quiz`        : quiz du jour (planifié ou calculé, puis figé).
- `users`       : profils, pseudos, suppression de compte.
- `play`        : partie en cours (chrono, réponses, résultats, historique).
- `planning`    : planning des jours à venir (admin).
- `insights`    : statistiques du tableau de bord (admin).
- `media`       : photos envoyées depuis l'admin.
- `demo`        : données fictives pour le développement local.
"""
