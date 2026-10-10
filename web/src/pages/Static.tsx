import { Link } from "react-router-dom";
import { APP_NAME } from "../lib/config";

export function Privacy() {
  return (
    <article className="card mt-4 space-y-4 p-6 leading-relaxed">
      <h1 className="text-3xl font-extrabold">Confidentialité</h1>
      <p>{APP_NAME} collecte le strict minimum :</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>ton adresse e-mail, si tu crées un compte ;</li>
        <li>ton pseudo ;</li>
        <li>l'historique de tes réponses et les statistiques qui en découlent.</li>
      </ul>
      <p>Pas de publicité, pas de revente, pas de pistage. L'authentification est gérée par Firebase (Google), les données sont stockées dans Firestore.</p>
      <p>Tu peux supprimer ton compte et toutes tes données à tout moment depuis ton <Link to="/profil" className="link">profil</Link>.</p>
      <p className="text-sm text-muted">Les illustrations des questions sont des créations originales de {APP_NAME}.</p>
    </article>
  );
}

export function NotFound() {
  return (
    <div className="card mt-4 space-y-4 p-6 text-center">
      <h1 className="text-3xl font-extrabold">Page introuvable</h1>
      <p className="text-muted">Ce n'est pas une question piège : cette page n'existe pas.</p>
      <Link to="/" className="btn-dark">Accueil</Link>
    </div>
  );
}
