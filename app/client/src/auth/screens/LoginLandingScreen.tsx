import type { JSX } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { AuthBadge } from "../components/AuthBadge";

export const LoginLandingScreen = (): JSX.Element => {
  return (
    <AuthShell>
      <div className="auth-decor auth-decor--large" />
      <div className="auth-decor auth-decor--small" />
      <div className="auth-hero">
        <AuthBadge />
        <h1 className="auth-title">Bem-vindo(a)</h1>
        <p className="auth-subtitle">Leia com traducoes instantaneas</p>
      </div>
      <div className="auth-features">
        <div className="auth-feature">
          <span className="auth-feature__dot" aria-hidden="true" />
          <span>Toque para traduzir palavras</span>
        </div>
        <div className="auth-feature">
          <span className="auth-feature__dot" aria-hidden="true" />
          <span>Leia sem interromper o ritmo</span>
        </div>
      </div>
      <div className="auth-actions">
        <Link className="auth-button auth-button--primary" to="/login">
          Entrar
        </Link>
        <div className="auth-divider">
          <span />
          <p>ou</p>
          <span />
        </div>
        <Link className="auth-button auth-button--secondary" to="/signup">
          Criar conta
        </Link>
      </div>
      <p className="auth-footer">Primeira vez aqui? E rapido e gratuito.</p>
    </AuthShell>
  );
};
