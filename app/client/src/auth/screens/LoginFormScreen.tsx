import type { FormEvent, JSX } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { AuthBadge } from "../components/AuthBadge";
import { hashPassword } from "../utils/hashPassword";
import { login } from "../api/authClient";
import { primeAuthSession } from "../utils/session";

export const LoginFormScreen = (): JSX.Element => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const passwordHash = await hashPassword(password);
      const session = await login({ email, passwordHash });
      primeAuthSession(session);
      setPassword("");
      navigate("/books", { replace: true });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Login failed.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-hero">
        <AuthBadge />
        <h1 className="auth-title">Entrar</h1>
        <p className="auth-subtitle">Bem-vindo de volta</p>
      </div>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label className="auth-label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          className="auth-input"
          type="text"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="seu@email.com"
        />
        <label className="auth-label" htmlFor="login-password">
          Senha
        </label>
        <input
          id="login-password"
          className="auth-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="********"
        />
        {error ? (
          <div className="auth-error" role="alert">
            {error}
          </div>
        ) : null}
        <button className="auth-button auth-button--primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <div className="auth-helper">
        <Link to="/signup">Nao tem conta? Criar conta</Link>
      </div>
    </AuthShell>
  );
};
