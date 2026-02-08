import { JSX, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ReaderScreen } from "./reader/screens/ReaderScreen/ReaderScreen";
import { LoginLandingScreen } from "./auth/screens/LoginLandingScreen";
import { LoginFormScreen } from "./auth/screens/LoginFormScreen";
import { SignupFormScreen } from "./auth/screens/SignupFormScreen";
import { getCachedAuthSession, refreshAuthSession } from "./auth/utils/session";
import { BookSelectionScreen } from "./books/screens/BookSelectionScreen";

type requireAuthProps = {
  children: JSX.Element;
};

const RequireAuth = ({ children }: requireAuthProps): JSX.Element => {
  const [status, setStatus] = useState<"checking" | "authed" | "guest">(() => {
    return getCachedAuthSession() ? "authed" : "checking";
  });

  useEffect(() => {
    let isMounted = true;
    refreshAuthSession()
      .then((session) => {
        if (isMounted) {
          setStatus(session ? "authed" : "guest");
        }
      })
      .catch(() => {
        if (isMounted) {
          setStatus("guest");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (status === "checking") {
    return <div className="auth-loading">Carregando...</div>;
  }

  if (status === "guest") {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export const App = (): JSX.Element => {
  useEffect(() => {
    refreshAuthSession().catch(() => null);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginLandingScreen />} />
        <Route path="/login" element={<LoginFormScreen />} />
        <Route path="/signup" element={<SignupFormScreen />} />
        <Route
          path="/books"
          element={
            <RequireAuth>
              <BookSelectionScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/reader"
          element={
            <RequireAuth>
              <ReaderScreen />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
