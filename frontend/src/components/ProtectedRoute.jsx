// frontend/src/components/ProtectedRoute.jsx
import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, ready } = useContext(AuthContext);

  // If auth provider is still checking localStorage / server, don't redirect yet.
  if (!ready) {
    // Optional: return a spinner component here instead of null
    return null;
  }

  // Once ready, redirect to login if there's no user
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
