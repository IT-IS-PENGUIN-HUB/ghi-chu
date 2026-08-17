import { Route, Router, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/AppShell";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useRecurring } from "@/hooks/useStore";
import { useGitHubSync } from "@/hooks/useGitHubSync";
import Contacts from "@/pages/Contacts";
import History from "@/pages/History";
import NotFound from "@/pages/NotFound";
import ProjectDetail from "@/pages/ProjectDetail";
import Projects from "@/pages/Projects";
import SearchPage from "@/pages/Search";
import Settings from "@/pages/Settings";
import Today from "@/pages/Today";

function Routes() {
  // Both run app-wide rather than per page: recurring tasks must appear
  // whichever screen you land on, and sync must not stop when you navigate.
  useRecurring();
  useGitHubSync();

  return (
    <Switch>
      <Route path="/" component={Today} />
      <Route path="/du-an" component={Projects} />
      <Route path="/du-an/:code" component={ProjectDetail} />
      <Route path="/lich-su" component={History} />
      <Route path="/lich-su/:date" component={History} />
      <Route path="/tim-kiem" component={SearchPage} />
      <Route path="/danh-ba" component={Contacts} />
      <Route path="/cai-dat" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * On GitHub Pages the app is served from /<repo>/, so every route and every
 * <Link> has to be offset by that prefix. BASE_URL is what Vite was built
 * with — "/" in dev, "/ghi-chu/" in production — and wouter wants it without
 * the trailing slash.
 */
const routerBase = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider delayDuration={300}>
          <Router base={routerBase}>
            <AppShell>
              <Routes />
            </AppShell>
          </Router>
          <Toaster position="top-center" />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
