import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Customers from "./pages/Customers";
import Suppliers from "./pages/Suppliers";
import KnowledgeBase from "./pages/KnowledgeBase";
import ImageLibrary from "./pages/ImageLibrary";
import AIAssistant from "./pages/AIAssistant";
import Materials from "./pages/Materials";
import LeadSources from "./pages/LeadSources";
import Consultation from "./pages/Consultation";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/projects" component={Projects} />
        <Route path="/projects/:id" component={ProjectDetail} />
        <Route path="/customers" component={Customers} />
        <Route path="/suppliers" component={Suppliers} />
        <Route path="/knowledge" component={KnowledgeBase} />
        <Route path="/images" component={ImageLibrary} />
        <Route path="/ai" component={AIAssistant} />
        <Route path="/materials" component={Materials} />
        <Route path="/leads" component={LeadSources} />
        <Route path="/consultation" component={Consultation} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
