import React from "react";
import Sidebar from "../components/Sidebar";
import "../styles/appshell.css";
import { Outlet } from "react-router-dom";

export default function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
