import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppStoreProvider } from "@/store/AppStore";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const PhiFlow = lazy(() => import("@/pages/PhiFlow"));
const Access = lazy(() => import("@/pages/Access"));
const Threats = lazy(() => import("@/pages/Threats"));
const Policy = lazy(() => import("@/pages/Policy"));
const AI = lazy(() => import("@/pages/AI"));
const Audit = lazy(() => import("@/pages/Audit"));
const Risks = lazy(() => import("@/pages/Risks"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex h-full min-h-[50vh] items-center justify-center">
    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

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
                    <Suspense fallback={<PageFallback />}>
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
                    </Suspense>
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
