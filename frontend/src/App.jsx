import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DeliveryAddress from "./pages/DeliveryAddress";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Checkout from "./pages/Checkout";
import CheckoutForm from "./components/CheckoutForm";
import AppShell from "./layout/AppShell";
import Dashboard from "./pages/Dashboard";
import LiveOrders from "./pages/LiveOrders";
import Profile from "./pages/Profile";
import OrderHistory from "./pages/OrderHistory";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./routes/AdminRoute";

import { AuthProvider } from "./contexts/AuthContext";

import "./styles/theme.css";

// Menu pages
import MenuPage from "./pages/Menu";
import MasterData from "./pages/MasterData";
import TotalOrders from "./pages/TotalOrders";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/reset" element={<ResetPassword />} />

          {/* Protected routes under AppShell */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            {/* /app → redirects to dashboard */}
            <Route index element={<Navigate to="dashboard" replace />} />

            {/* user pages */}
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="checkout-form" element={<CheckoutForm />} />
            <Route path="live-orders" element={<LiveOrders />} />
            <Route path="total-orders" element={<TotalOrders />} />
            <Route path="orders" element={<OrderHistory />} />
            <Route path="profile" element={<Profile />} />
            <Route path="address" element={<DeliveryAddress />} />

            {/* ADMIN pages INSIDE appshell */}
            <Route
              path="admin/menu"
              element={
                <AdminRoute>
                  <MasterData />
                </AdminRoute>
              }
            />
          </Route>

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
