// client/src/layout/Sidebar.jsx
import React, { useContext } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
import "../styles/appshell.css";

export default function Sidebar() {
  const { user, logout } = useContext(AuthContext);
  const nav = useNavigate();

  function doLogout() {
    logout();
    nav("/"); // back to landing page
  }

  return (
    <aside className="app-sidebar">
      {/* TOP AREA */}
      <div className="sidebar-top">
        <div className="brand">Mirchi Mafiya</div>

        <div className="user-info">
          <div className="user-name">{user?.name || user?.email}</div>
          <div className="user-role">{user?.role || "user"}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* Visible to ALL logged-in users */}
        <NavLink to="/app/dashboard" className="nav-link">
          Dashboard
        </NavLink>

        <NavLink to="/app/menu" className="nav-link">
          Menu
        </NavLink>

        <NavLink to="/app/orders" className="nav-link">
          Orders History
        </NavLink>

        <NavLink to="/app/profile" className="nav-link">
          Profile
        </NavLink>

        <NavLink to="/app/address" className="nav-link">
          Delivery Address
        </NavLink>

        {/* ADMIN ONLY */}
        {user?.role === "admin" && (
          <>
            <NavLink to="/app/live-orders" className="nav-link">
              Live Orders
            </NavLink>

            <NavLink to="/app/admin/menu" className="nav-link">
              Master Data
            </NavLink>

            {/* fixed: Admin Total Orders link now points to /app/total-orders */}
            <NavLink to="/app/total-orders" className="nav-link">
              Total Orders
            </NavLink>
          </>
        )}
      </nav>

      {/* BOTTOM / LOGOUT */}
      <div className="sidebar-bottom">
        <button className="btn-logout" onClick={doLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}
