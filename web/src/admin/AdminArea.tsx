// Espace fondateur, chargé à part (import dynamique depuis App.tsx) : les joueurs ne téléchargent jamais ce code.
import { Route, Routes } from "react-router-dom";
import { AdminLayout } from "./AdminLayout";
import { Dashboard } from "./Dashboard";
import { Planning } from "./Planning";
import { QuestionsPage, ReportsPage } from "./QuestionsPage";

export default function AdminArea() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="planning" element={<Planning />} />
        <Route path="questions" element={<QuestionsPage key="bank" mode="bank" />} />
        <Route path="questions/passees" element={<QuestionsPage key="past" mode="past" />} />
        <Route path="signalements" element={<ReportsPage />} />
      </Route>
    </Routes>
  );
}
