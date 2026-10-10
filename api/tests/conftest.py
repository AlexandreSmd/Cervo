import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Les tests d'intégration utilisent un projet d'émulateur séparé : les données de dev restent intactes.
os.environ.setdefault("FIREBASE_PROJECT_ID", "demo-cervo-daily")
os.environ["FIRESTORE_PROJECT_ID"] = "demo-cervo-test"
os.environ["APP_ENV"] = "local"
os.environ.setdefault("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080")
os.environ.setdefault("FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099")
os.environ["ADMIN_EMAILS"] = "admin@cervo.test"
