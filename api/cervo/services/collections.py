"""Noms des collections Firestore (voir docs/ARCHITECTURE.md pour le schéma complet)."""

QUESTIONS = "questions"  # questions/{id} : la banque
DAILY_QUIZZES = "daily_quizzes"  # daily_quizzes/{AAAA-MM-JJ} : les 10 questions du jour, dans l'ordre
DAILY_STATS = "daily_stats"  # daily_stats/{AAAA-MM-JJ} : agrégats du jour (tableau de bord)
QUESTION_STATS = "question_stats"  # question_stats/{id} : réussite cumulée d'une question
USERS = "users"  # users/{uid} : profil et agrégats du joueur
ATTEMPTS = "attempts"  # users/{uid}/attempts/{AAAA-MM-JJ} : participation d'un jour
MONTHLY_SCORES = "monthly_scores"  # monthly_scores/{AAAA-MM}/players/{uid} : classement du mois
USERNAMES = "usernames"  # usernames/{pseudo en minuscules} : unicité des pseudos
REPORTS = "reports"  # reports/{id} : signalements de questions
MEDIA = "media"  # media/{id} : photos envoyées depuis l'admin
META = "meta"  # meta/bank : numéro de version de la banque (le cache des serveurs se recharge s'il change)
