import React from "react";
import { Link } from "react-router-dom";
import "../styles/landing.css";
import heroImg from "../assets/landing-food.jpg";

export default function Landing() {
  return (
    <div className="hero">
      <div className="hero-left">
        <div className="brand">FoodRush</div>

        <h1 className="headline">
          Delicious food, delivered fast.
        </h1>

        <p className="sub">
          Order from local restaurants and get your favorites delivered hot
          to your door.
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

      <div className="hero-right">
        <img src={heroImg} alt="food" className="hero-image" />
      </div>
    </div>
  );
}
