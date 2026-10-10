"""Erreur métier renvoyée telle quelle au client (statut HTTP + message lisible en français)."""


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message
