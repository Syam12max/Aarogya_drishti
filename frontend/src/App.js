import React from "react";
import "./App.css";

import LoginPage from "./components/LoginPage";
import DistrictDashboard from "./components/DistrictDashboard";

import SpecialistLogin from "./components/SpecialistLogin";
import NavigatorLogin from "./components/NavigatorLogin";
import AdditionalRoleLogin from "./components/AdditionalRoleLogin";

function App() {
  const path = window.location.pathname;

  if (path === "/district-dashboard") {
    const token = localStorage.getItem("aarogyaToken");
    const user = localStorage.getItem("aarogyaUser");

    if (token && user) {
      return <DistrictDashboard />;
    }

    window.location.replace("/");
    return null;
  }

  if (path === "/specialist-dashboard") {
    return <SpecialistLogin language="en" />;
  }

  if (path === "/navigator-dashboard") {
    return <NavigatorLogin language="en" />;
  }

  if (path === "/hospital-staff-dashboard") {
    return <AdditionalRoleLogin language="en" role="HOSPITAL_STAFF" />;
  }

  return (
    <div className="App">
      <LoginPage />
    </div>
  );
}

export default App;