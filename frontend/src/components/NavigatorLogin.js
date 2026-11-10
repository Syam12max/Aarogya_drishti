
import React from "react";
import AdditionalRoleLogin from "./AdditionalRoleLogin";

function NavigatorLogin({ language = "en" }) {
  return (
    <AdditionalRoleLogin
      language={language}
      role="NAVIGATOR"
    />
  );
}

export default NavigatorLogin;
