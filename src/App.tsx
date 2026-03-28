import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Holdings from "./pages/Holdings";
import Transactions from "./pages/Transactions";
import FundDetail from "./pages/FundDetail";
import SettingsPage from "./pages/Settings";
import RetirementPlanner from "./pages/RetirementPlanner";
import MyPlan from "./pages/MyPlan";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/holdings" element={<Holdings />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/funds/:id" element={<FundDetail />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/my-plan" element={<MyPlan />} />
          <Route path="/retirement-planner" element={<RetirementPlanner />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
