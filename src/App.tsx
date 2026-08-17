import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppStoreProvider } from "@/store/AppStore";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import PhiFlow from "@/pages/PhiFlow";
import Access from "@/pages/Access";
import Threats from "@/pages/Threats";
import Policy from "@/pages/Policy";
import AI from "@/pages/AI";
import Audit from "@/pages/Audit";
import Risks from "@/pages/Risks";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster richColors position="bottom-right" />
      <AppStoreProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/phi-flow" element={<PhiFlow />} />
                      <Route path="/access" element={<Access />} />
                      <Route path="/threats" element={<Threats />} />
                      <Route path="/policy" element={<Policy />} />
                      <Route path="/ai" element={<AI />} />
                      <Route path="/audit" element={<Audit />} />
                      <Route path="/risks" element={<Risks />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AppStoreProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
