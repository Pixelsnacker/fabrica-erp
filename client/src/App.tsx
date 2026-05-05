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
import Suppliers from './pages/Suppliers';
import SupplierDetail from './pages/SupplierDetail';
import KnowledgeBase from "./pages/KnowledgeBase";
import ImageLibrary from "./pages/ImageLibrary";
import AIAssistant from "./pages/AIAssistant";
import Materials from "./pages/Materials";
import LeadSources from "./pages/LeadSources";
import Consultation from "./pages/Consultation";
import Settings from "@/pages/Settings";
import Notes from "@/pages/Notes";
import Complaints from "@/pages/Complaints";
import Invoices from "@/pages/Invoices";
import Calendar from "@/pages/Calendar";
import Articles from "@/pages/Articles";
import Inquiries from "@/pages/Inquiries";
import Statistics from "@/pages/Statistics";
import ProjectPortal from "./pages/ProjectPortal";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/projects" component={Projects} />
        <Route path="/projects/:id" component={ProjectDetail} />
        <Route path="/customers" component={Customers} />
        <Route path="/suppliers" component={Suppliers} />
        <Route path="/suppliers/:id" component={SupplierDetail} />
        <Route path="/knowledge" component={KnowledgeBase} />
        <Route path="/images" component={ImageLibrary} />
        <Route path="/ai" component={AIAssistant} />
        <Route path="/materials" component={Materials} />
        <Route path="/leads" component={LeadSources} />
        <Route path="/consultation" component={Consultation} />
        <Route path="/settings" component={Settings} />
        <Route path="/notes" component={Notes} />
        <Route path="/complaints" component={Complaints} />
        <Route path="/articles" component={Articles} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/invoices/new" component={Invoices} />
        <Route path="/inquiries" component={Inquiries} />
        <Route path="/statistics" component={Statistics} />
        <Route path="/calendar" component={Calendar} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Switch>
            {/* Öffentliches Kundenportal — außerhalb DashboardLayout, helles Design */}
            <Route path="/projekt-portal/:id" component={ProjectPortal} />
            {/* Alle anderen Routen — innerhalb DashboardLayout */}
            <Route component={Router} />
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
