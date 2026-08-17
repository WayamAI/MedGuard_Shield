import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider } from "@/hooks/use-auth";
import "./index.css";

createRoot(document.getElementById("root")!).render(
	<ThemeProvider>
		<AuthProvider>
			<App />
		</AuthProvider>
	</ThemeProvider>,
);
