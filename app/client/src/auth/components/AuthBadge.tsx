import type { JSX } from "react";

export const AuthBadge = (): JSX.Element => {
  return (
    <div className="auth-badge" aria-hidden="true">
      <svg viewBox="0 0 80 80" role="presentation">
        <path
          d="M20 30 Q30 24 40 30 Q50 24 60 30 L60 54 Q50 60 40 54 Q30 60 20 54 Z"
          fill="#ffffff"
          stroke="currentColor"
          strokeWidth="2"
        />
        <line x1="40" y1="30" x2="40" y2="54" stroke="currentColor" strokeWidth="2" />
        <line
          x1="26"
          y1="36"
          x2="36"
          y2="36"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="26"
          y1="42"
          x2="36"
          y2="42"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="26"
          y1="48"
          x2="36"
          y2="48"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="44"
          y1="36"
          x2="54"
          y2="36"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="44"
          y1="42"
          x2="54"
          y2="42"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="44"
          y1="48"
          x2="54"
          y2="48"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
