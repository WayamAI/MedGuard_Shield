import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";

/**
 * Routes are one per backed capability, and nothing else.
 *
 * /ai remains absent: it was rendered entirely from a bundled fixture and the
 * API still has no AI surface, so there is nothing honest to draw.
 *
 * /audit and /policies are back, and /controls, /remediation, /users and
 * /settings are new — all six against endpoints the API now provides. Where a
 * collection is empty (controls, policies and remediation are unseeded today)
 * the page renders its empty state rather than being hidden: the capability is
 * real, the estate simply has no rows yet.
 */
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Assets = lazy(() => import("@/pages/Assets"));
const PhiFlow = lazy(() => import("@/pages/PhiFlow"));
const Access = lazy(() => import("@/pages/Access"));
const Threats = lazy(() => import("@/pages/Threats"));
const Risks = lazy(() => import("@/pages/Risks"));
const Vendors = lazy(() => import("@/pages/Vendors"));
const ImportData = lazy(() => import("@/pages/ImportData"));
const Remediation = lazy(() => import("@/pages/Remediation"));
const Controls = lazy(() => import("@/pages/Controls"));
const Policies = lazy(() => import("@/pages/Policies"));
const AuditTrail = lazy(() => import("@/pages/Audit"));
const Users = lazy(() => import("@/pages/Users"));
const Settings = lazy(() => import("@/pages/Settings"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex h-full min-h-[50vh] items-center justify-center">
    <div className="h-8 w-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster richColors position="bottom-right" />
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
                      <Route path="/assets" element={<Assets />} />
                      <Route path="/phi-flow" element={<PhiFlow />} />
                      <Route path="/access" element={<Access />} />
                      <Route path="/threats" element={<Threats />} />
                      <Route path="/risks" element={<Risks />} />
                      <Route path="/vendors" element={<Vendors />} />
                      <Route path="/remediation" element={<Remediation />} />
                      <Route path="/controls" element={<Controls />} />
                      <Route path="/policies" element={<Policies />} />
                      <Route path="/users" element={<Users />} />
                      <Route path="/settings" element={<Settings />} />
                      {/* Audit is ADMIN-only server-side; gate it here too so
                          a typed URL does not reach a page that only 403s. */}
                      <Route
                        path="/audit"
                        element={
                          <ProtectedRoute requireRole={["ADMIN"]}>
                            <AuditTrail />
                          </ProtectedRoute>
                        }
                      />
                      {/* The API is ADMIN-only here; this keeps a non-admin
                          who types the URL from reaching a page that would
                          only 403 on every call. */}
                      <Route
                        path="/import"
                        element={
                          <ProtectedRoute requireRole={["ADMIN"]}>
                            <ImportData />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
