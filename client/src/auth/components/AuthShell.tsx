import type { ReactNode, JSX } from "react";

type authShellProps = {
  children: ReactNode;
};

export const AuthShell = ({ children }: authShellProps): JSX.Element => {
  return (
    <div className="page auth-page">
      <div className="browser-shell auth-shell">
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
};
