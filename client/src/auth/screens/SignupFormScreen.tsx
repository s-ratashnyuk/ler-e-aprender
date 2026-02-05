import type { FormEvent, JSX } from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { AuthBadge } from "../components/AuthBadge";
import { hashPassword } from "../utils/hashPassword";
import { signup } from "../api/authClient";
import { primeAuthSession } from "../utils/session";

export const SignupFormScreen = (): JSX.Element => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas nao conferem.");
      return;
    }

    setIsSubmitting(true);

    try {
      const passwordHash = await hashPassword(password);
      const session = await signup({ email, passwordHash });
      primeAuthSession(session);
      setPassword("");
      setConfirmPassword("");
      navigate("/reader", { replace: true });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Signup failed.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="auth-hero">
        <AuthBadge />
        <h1 className="auth-title">Criar conta</h1>
        <p className="auth-subtitle">Comece a ler em minutos</p>
      </div>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label className="auth-label" htmlFor="signup-email">
          Email
        </label>
        <input
          id="signup-email"
          className="auth-input"
          type="text"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="seu@email.com"
        />
        <label className="auth-label" htmlFor="signup-password">
          Senha
        </label>
        <input
          id="signup-password"
          className="auth-input"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="********"
        />
        <label className="auth-label" htmlFor="signup-password-confirm">
          Confirmar senha
        </label>
        <input
          id="signup-password-confirm"
          className="auth-input"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="********"
        />
        {error ? (
          <div className="auth-error" role="alert">
            {error}
          </div>
        ) : null}
        <button className="auth-button auth-button--primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Criando..." : "Criar conta"}
        </button>
      </form>
      <div className="auth-helper">
        <Link to="/login">Ja tem conta? Entrar</Link>
      </div>
    </AuthShell>
  );
};
