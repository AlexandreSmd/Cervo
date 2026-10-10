import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Admin } from "./pages/Admin";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Play } from "./pages/Play";
import { Profile } from "./pages/Profile";
import { PastDay, Results } from "./pages/Results";
import { About, NotFound, Privacy } from "./pages/Static";

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/jouer" element={<Play />} />
        <Route path="/resultats/:date" element={<Results />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="/profil/:date" element={<PastDay />} />
        <Route path="/connexion" element={<Login />} />
        <Route path="/a-propos" element={<About />} />
        <Route path="/confidentialite" element={<Privacy />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
