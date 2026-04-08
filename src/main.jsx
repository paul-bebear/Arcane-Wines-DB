import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/AuthContext.jsx";
import "./index.css";

// Pages
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Catalog from "./pages/Catalog.jsx";
import Movements from "./pages/Movements.jsx";
import Btg from "./pages/Btg.jsx";
import Revenue from "./pages/Revenue.jsx";
import Purchases from "./pages/Purchases.jsx";
import Spreadsheet from "./pages/Spreadsheet.jsx";
import Layout from "./components/Layout.jsx";

// ── Guards ──────────────────────────────────────────────────────────────
function AuthGate({ children }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="loading-center" style={{ minHeight: "100vh" }}>
        <div className="spinner" />
        <span>Loading…</span>
      </div>
    );
  }
  return session ? children : <Navigate to="/login" replace />;
}

function OwnerRoute({ children }) {
  const { role } = useAuth();
  return role === "owner" ? children : <Navigate to="/catalog" replace />;
}

// ── App ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <AuthGate>
              <Layout />
            </AuthGate>
          }
        >
          {/* Owner-only routes */}
          <Route path="/" element={<OwnerRoute><Dashboard /></OwnerRoute>} />
          <Route path="/revenue" element={<OwnerRoute><Revenue /></OwnerRoute>} />
          <Route path="/movements" element={<OwnerRoute><Movements /></OwnerRoute>} />
          <Route path="/btg" element={<OwnerRoute><Btg /></OwnerRoute>} />
          <Route path="/purchases" element={<OwnerRoute><Purchases /></OwnerRoute>} />
          <Route path="/spreadsheet" element={<OwnerRoute><Spreadsheet /></OwnerRoute>} />

          {/* Shared routes */}
          <Route path="/catalog" element={<Catalog />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

// ── Mount ───────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
