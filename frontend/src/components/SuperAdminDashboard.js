
import React, { useEffect, useState } from "react";
import "./SuperAdminDashboard.css";

function SuperAdminDashboard({ language = "en", onLogout }) {
  const te = language === "te";
  const token = sessionStorage.getItem("adminToken");

  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const t = {
    title: te ? "సూపర్ అడ్మిన్ డాష్‌బోర్డ్" : "Super Admin Dashboard",
    pending: te ? "పెండింగ్ రిజిస్ట్రేషన్లు" : "Pending Registrations",
    refresh: te ? "రిఫ్రెష్" : "Refresh",
    name: te ? "పేరు" : "Name",
    username: te ? "యూజర్ పేరు" : "Username",
    phone: te ? "ఫోన్" : "Phone",
    role: te ? "పాత్ర" : "Role",
    designation: te ? "హోదా" : "Designation",
    facility: "Facility",
    date: te ? "తేదీ" : "Date",
    action: te ? "చర్యలు" : "Actions",
    approve: te ? "ఆమోదించు" : "Approve",
    reject: te ? "తిరస్కరించు" : "Reject",
    noData: te ? "పెండింగ్ రిజిస్ట్రేషన్లు లేవు." : "No pending registrations found.",
    loading: te ? "లోడ్ అవుతోంది..." : "Loading...",
    logout: te ? "లాగ్ అవుట్" : "Logout",
    loadError: "Unable to fetch registrations.",
    approved: "Registration approved successfully.",
    rejected: "Registration rejected successfully.",
    reason: "Enter rejection reason:",
  };

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(
        "http://localhost:5000/api/auth/admin/pending-registrations",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || t.loadError);
      }

      setRegistrations(data.registrations || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const approveRegistration = async (id) => {
    if (!window.confirm("Approve this registration?")) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/auth/admin/approve-registration/${id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Approval failed.");
      }

      setMessage(t.approved);
      await fetchRegistrations();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const rejectRegistration = async (id) => {
    const rejectionReason = window.prompt(t.reason);

    if (!rejectionReason || !rejectionReason.trim()) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/auth/admin/reject-registration/${id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rejectionReason: rejectionReason.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Rejection failed.");
      }

      setMessage(t.rejected);
      await fetchRegistrations();
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="admin-login-page">
      <div
        className="admin-login-card"
        style={{ width: "95%", maxWidth: "1100px" }}
      >
        <h1>{t.title}</h1>
        <p>Aarogya Drishti</p>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "20px",
          }}
        >
          <h3>
            {t.pending}: {registrations.length}
          </h3>

          <div style={{ display: "flex", gap: "10px" }}>
            <button type="button" onClick={fetchRegistrations}>
              {t.refresh}
            </button>

            <button type="button" onClick={onLogout}>
              {t.logout}
            </button>
          </div>
        </div>

        {message && (
          <div className="admin-login-message">
            {message}
          </div>
        )}

        <h2>{t.pending}</h2>

        {loading ? (
          <p>{t.loading}</p>
        ) : registrations.length === 0 ? (
          <p>{t.noData}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                minWidth: "950px",
              }}
            >
              <thead>
                <tr>
                  {[
                    t.name,
                    t.username,
                    t.phone,
                    t.role,
                    t.designation,
                    t.facility,
                    t.date,
                    t.action,
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: "12px",
                        borderBottom: "1px solid #ddd",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {registrations.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: "12px" }}>
                      {item.full_name}
                    </td>

                    <td style={{ padding: "12px" }}>
                      {item.username}
                    </td>

                    <td style={{ padding: "12px" }}>
                      {item.phone}
                    </td>

                    <td style={{ padding: "12px" }}>
                      {item.requested_role}
                    </td>

                    <td style={{ padding: "12px" }}>
                      {item.designation || "-"}
                    </td>

                    <td style={{ padding: "12px" }}>
                      {item.facility_name || item.facility_id}
                    </td>

                    <td style={{ padding: "12px" }}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>

                    <td
                      style={{
                        padding: "12px",
                        display: "flex",
                        gap: "6px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => approveRegistration(item.id)}
                      >
                        {t.approve}
                      </button>

                      <button
                        type="button"
                        onClick={() => rejectRegistration(item.id)}
                      >
                        {t.reject}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default SuperAdminDashboard;
