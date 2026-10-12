// Routes : l'interface joueur (onglets Jouer / Profil) et l'espace fondateur (/admin).
// Ce qui ne sert pas à jouer (espace fondateur, connexion) est chargé à la demande :
// le premier affichage sur téléphone ne télécharge que le nécessaire.
import { lazy, Suspense } from "react";
import { Outlet, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Loading } from "./components/States";
import { Home } from "./pages/Home";
import { Play } from "./pages/Play";
import { Profile } from "./pages/Profile";
import { PastDay, Results } from "./pages/Results";
import { NotFound, Privacy } from "./pages/Static";

const AdminArea = lazy(() => import("./admin/AdminArea"));
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));

function PlayerShell() {
  return (
    <Layout>
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
}

export function App() {
  return (
    <Routes>
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<Loading />}>
            <AdminArea />
          </Suspense>
        }
      />
      <Route element={<PlayerShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/jouer" element={<Play />} />
        <Route path="/resultats/:date" element={<Results />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="/profil/:date" element={<PastDay />} />
        <Route path="/connexion" element={<Login />} />
        <Route path="/confidentialite" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
