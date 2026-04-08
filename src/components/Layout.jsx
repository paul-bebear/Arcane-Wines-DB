import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { useState, useEffect } from "react";

const NAV = [
  { to: "/",          label: "Dashboard",   icon: "📊", ownerOnly: true },
  { to: "/catalog",   label: "Catalog",     icon: "🍷", ownerOnly: false },
  { to: "/movements", label: "Movements",   icon: "📦", ownerOnly: true },
  { to: "/btg",       label: "By the Glass", icon: "🥂", ownerOnly: true },
  { to: "/revenue",   label: "Revenue",     icon: "💰", ownerOnly: true },
  { to: "/purchases", label: "Purchases",   icon: "🛒", ownerOnly: true },
];

function getInitialTheme() {
  const stored = localStorage.getItem("arcane-theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function Layout() {
  const { user, role, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);

  // Apply theme on mount and change
  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("arcane-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const isDark = theme === "dark";

  const sideW = collapsed ? 56 : 210;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="sidebar" style={{ width: sideW }}>
        {/* Brand */}
        <div
          style={{
            padding: collapsed ? "8px 0" : "8px 12px",
            marginBottom: 20,
            textAlign: collapsed ? "center" : "left",
            cursor: "pointer",
          }}
          onClick={() => setCollapsed(!collapsed)}
        >
          <div style={{
            fontSize: collapsed ? 22 : 18, fontWeight: 700,
            color: "var(--color-brand)",
            whiteSpace: "nowrap",
          }}>
            {collapsed ? "🍷" : "Arcane Wines"}
          </div>
          {!collapsed && (
            <div style={{
              fontSize: 10, color: "var(--color-text-tertiary)",
              marginTop: 2, display: "flex", alignItems: "center", gap: 4,
            }}>
              <span>Inventory</span>
              <span style={{
                padding: "1px 5px", borderRadius: 4, fontSize: 9,
                background: "var(--color-brand)", color: "#fff", fontWeight: 700,
              }}>v3.0</span>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.filter((n) => !n.ownerOnly || role === "owner").map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              style={{
                padding: collapsed ? "10px 0" : undefined,
                justifyContent: collapsed ? "center" : undefined,
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{n.icon}</span>
              {!collapsed && <span>{n.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom controls */}
        <div style={{
          display: "flex", flexDirection: "column", gap: 2,
          paddingTop: 12, borderTop: "1px solid var(--color-border-tertiary)",
        }}>
          {/* User info */}
          {!collapsed && user && (
            <div style={{
              padding: "6px 12px", fontSize: 11,
              color: "var(--color-text-tertiary)", marginBottom: 4,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {user.email}
            </div>
          )}
          <button
            onClick={toggleTheme}
            className="btn btn-ghost"
            style={{ justifyContent: collapsed ? "center" : "flex-start", fontSize: 12, width: "100%" }}
          >
            {collapsed
              ? (isDark ? "☀️" : "🌙")
              : (isDark ? "☀️ Light mode" : "🌙 Dark mode")
            }
          </button>
          <button
            onClick={signOut}
            className="btn btn-ghost"
            style={{
              justifyContent: collapsed ? "center" : "flex-start", fontSize: 12,
              color: "var(--color-text-tertiary)", width: "100%",
            }}
          >
            {collapsed ? "→" : "Sign out"}
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main style={{
        flex: 1, marginLeft: sideW,
        padding: "24px 32px", minWidth: 0,
        width: `calc(100vw - ${sideW}px)`,
        boxSizing: "border-box",
        transition: "margin-left 0.25s cubic-bezier(0.22, 1, 0.36, 1), width 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
      }}>
        <Outlet />
      </main>
    </div>
  );
}
