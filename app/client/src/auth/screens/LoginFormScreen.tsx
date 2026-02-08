import type { JSX } from "react";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { AuthBadge } from "../components/AuthBadge";

const getAuthErrorMessage = (search: string): string | null => {
  const params = new URLSearchParams(search);
  const error = params.get("error");
  if (!error) {
    return null;
  }

  switch (error) {
    case "oauth_denied":
      return "Autenticacao cancelada. Tente novamente.";
    case "state_mismatch":
      return "Sessao expirada. Tente novamente.";
    case "email_unverified":
      return "Seu email do Google precisa estar verificado.";
    default:
      return "Nao foi possivel autenticar. Tente novamente.";
  }
};

export const LoginFormScreen = (): JSX.Element => {
  const location = useLocation();
  const errorMessage = useMemo(() => getAuthErrorMessage(location.search), [location.search]);

  return (
    <AuthShell>
      <div className="auth-hero">
        <AuthBadge />
        <h1 className="auth-title">Entrar</h1>
        <p className="auth-subtitle">Use sua conta do Google</p>
      </div>
      <div className="auth-actions">
        <a className="auth-button auth-button--primary" href="/api/auth/google">
          Authenticate with Google
        </a>
      </div>
      {errorMessage ? (
        <div className="auth-error" role="alert">
          {errorMessage}
        </div>
      ) : null}
    </AuthShell>
  );
};
