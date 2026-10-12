// Point d'entrée du navigateur : cache des requêtes, session Firebase, routeur.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { isTransient } from "./lib/api";
import { AuthProvider } from "./lib/auth";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Réseau mobile : jusqu'à 2 nouvelles tentatives (après 0,5 s puis 1,5 s), seulement si l'erreur est passagère.
      retry: (count, error) => count < 2 && isTransient(error),
      retryDelay: (attempt) => (attempt === 0 ? 500 : 1500),
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
