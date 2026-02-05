import { JSX } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ReaderScreen } from "./reader/screens/ReaderScreen/ReaderScreen";
import { LoginLandingScreen } from "./auth/screens/LoginLandingScreen";
import { LoginFormScreen } from "./auth/screens/LoginFormScreen";
import { SignupFormScreen } from "./auth/screens/SignupFormScreen";
import { readAuthSession } from "./auth/utils/session";

type requireAuthProps = {
  children: JSX.Element;
};

const RequireAuth = ({ children }: requireAuthProps): JSX.Element => {
  const session = readAuthSession();
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export const App = (): JSX.Element => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginLandingScreen />} />
        <Route path="/login" element={<LoginFormScreen />} />
        <Route path="/signup" element={<SignupFormScreen />} />
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
