// Not routed by App.tsx (see src/App.tsx) — the app's actual entry point is
// the Dashboard page behind ProtectedRoute. This file is kept only so an
// accidental import doesn't break the build; it renders nothing of its own.
import { Navigate } from "react-router-dom";

const Index = () => <Navigate to="/" replace />;

export default Index;
