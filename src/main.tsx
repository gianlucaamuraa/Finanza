import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import "@fontsource-variable/inter";
import "./styles.css";
import { queryClient } from "./queryClient";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <App />
        </HashRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
