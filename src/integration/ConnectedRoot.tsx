import App from "../App";
import { Card } from "../components/ui";
import { configurationError, integrationConfig } from "./config";
import { SessionProvider } from "./SessionProvider";
import { AuthBoundary } from "./AuthBoundary";
export function ConnectedRoot() {
  const error = configurationError();
  if (integrationConfig.mode === "demo") return <App />;
  if (error)
    return (
      <main className="auth-page">
        <Card title="Configura la conexión de Find Food">
          <p role="alert">{error}</p>
          <p>
            Copia .env.example a .env.local, completa sus valores y reinicia npm
            run dev.
          </p>
          <p>Para explorar el cascarón utiliza VITE_DATA_MODE=demo.</p>
        </Card>
      </main>
    );
  return (
    <SessionProvider>
      <AuthBoundary>
        <App />
      </AuthBoundary>
    </SessionProvider>
  );
}
