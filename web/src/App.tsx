// Routes : l'interface joueur (onglets Jouer / Profil) et l'espace fondateur (/admin).
import { Outlet, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./admin/AdminLayout";
import { Dashboard } from "./admin/Dashboard";
import { Planning } from "./admin/Planning";
import { QuestionsPage, ReportsPage } from "./admin/QuestionsPage";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Play } from "./pages/Play";
import { Profile } from "./pages/Profile";
import { PastDay, Results } from "./pages/Results";
import { NotFound, Privacy } from "./pages/Static";

function PlayerShell() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="planning" element={<Planning />} />
        <Route path="questions" element={<QuestionsPage key="bank" mode="bank" />} />
        <Route path="questions/passees" element={<QuestionsPage key="past" mode="past" />} />
        <Route path="signalements" element={<ReportsPage />} />
      </Route>
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
