import { Link } from "react-router-dom";
import { APP_NAME } from "../lib/config";

export function About() {
  return (
    <article className="card space-y-4 p-6 leading-relaxed">
      <h1 className="text-3xl font-extrabold">À propos de {APP_NAME}</h1>
      <p>{APP_NAME} est la salle de sport quotidienne du cerveau, pensée pour une époque où l'IA réfléchit de plus en plus à notre place.</p>
      <p>Chaque jour : <strong>10 questions</strong>, les mêmes pour tout le monde, <strong>sans aide</strong>. Chaque réponse reçoit un score de 0 à 100. Sur les estimations, plus tu es proche, plus tu marques de points.</p>
      <h2 className="text-xl font-bold">Les quatre piliers</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Raisonnement</strong> : logique et réflexion.</li>
        <li><strong>Estimation</strong> : estimation, géographie, sciences.</li>
        <li><strong>Mémoire et culture</strong> : culture générale, histoire, arts, nature, sport.</li>
        <li><strong>Esprit critique</strong> : vrai ou faux, idées reçues.</li>
      </ul>
      <h2 className="text-xl font-bold">Comment le score est calculé</h2>
      <p>Vrai/faux, QCM et réponses courtes : 100 si c'est juste, 0 sinon. Estimations : le score baisse avec l'écart à la bonne valeur (en proportion pour les grandes valeurs, comme une hauteur ou une population). Le score du jour est la moyenne des 10 questions.</p>
      <h2 className="text-xl font-bold">Crédits des images</h2>
      <p>Toutes les images des questions sont des illustrations originales créées pour {APP_NAME} (silhouettes, drapeaux, figures). Elles ne sont pas à l'échelle exacte.</p>
      <h2 className="text-xl font-bold">Contact</h2>
      <p>Une question erronée ? Utilise le bouton « Signaler une erreur » après ta réponse.</p>
      <Link to="/" className="btn-primary">Jouer</Link>
    </article>
  );
}

export function Privacy() {
  return (
    <article className="card space-y-4 p-6 leading-relaxed">
      <h1 className="text-3xl font-extrabold">Confidentialité</h1>
      <p>{APP_NAME} collecte le strict minimum :</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>ton adresse e-mail, si tu crées un compte ;</li>
        <li>ton pseudo ;</li>
        <li>l'historique de tes réponses et les statistiques qui en découlent.</li>
      </ul>
      <p>Pas de publicité, pas de revente, pas de pistage. L'authentification est gérée par Firebase (Google), les données sont stockées dans Firestore.</p>
      <p>Tu peux supprimer ton compte et toutes tes données à tout moment depuis ton <Link to="/profil" className="link">profil</Link>.</p>
    </article>
  );
}

export function NotFound() {
  return (
    <div className="card space-y-4 p-6 text-center">
      <h1 className="text-3xl font-extrabold">Page introuvable</h1>
      <p className="text-muted">Ce n'est pas une question piège : cette page n'existe pas.</p>
      <Link to="/" className="btn-primary">Retour à l'accueil</Link>
    </div>
  );
}
