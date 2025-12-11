import React from "react";
import { Link } from "react-router-dom";
import "../styles/landing.css";
import heroBg from "../assets/landing-food.jpg";

export default function Landing() {
  return (
    <div className="landing-root">
      {/* background image element (fills the right / behind content) */}
      <div
        className="landing-bg"
        style={{ backgroundImage: `url(${heroBg})` }}
        aria-hidden="true"
      />

      {/* main content */}
      <div className="landing-content">
        <div className="brand">Mirchi Mafiya</div>

        <h1 className="headline">Delicious food, delivered fast.</h1>

        <p className="sub">
          Order from our Food Truck and get your favorites delivered hot to your door.
        </p>

        <div className="cta-row">
          <Link to="/login">
            <button className="btn btn-primary">Sign in</button>
          </Link>
          <Link to="/signup">
            <button className="btn btn-outline">Sign up</button>
          </Link>
        </div>
      </div>
    </div>
  );
}
