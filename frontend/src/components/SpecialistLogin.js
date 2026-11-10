
import React from "react";
import AdditionalRoleLogin from "./AdditionalRoleLogin";

function SpecialistLogin({ language = "en" }) {
  return (
    <AdditionalRoleLogin
      language={language}
      role="SPECIALIST"
    />
  );
}

export default SpecialistLogin;
