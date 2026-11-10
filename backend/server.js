
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { connectDB } = require("./db");

// ========================================
// ROUTE IMPORTS
// ========================================

const authRoutes = require("./routes/authRoutes");
const patientRoutes = require("./routes/patientRoutes");
const screeningRoutes = require("./routes/screeningRoutes");
const locationRoutes = require("./routes/locationRoutes");
const districtPatientRoutes = require("./routes/districtPatientRoutes");
const referralRoutes = require("./routes/referralRoutes");

// ========================================
// EXPRESS APP
// ========================================

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ========================================
// HOME API
// ========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Aarogya Drishti Backend is Running",
  });
});

// ========================================
// EXISTING APIs
// ========================================

app.use("/api/auth", authRoutes);

app.use("/api/patients", patientRoutes);

app.use("/api/screenings", screeningRoutes);

app.use("/api/locations", locationRoutes);

// ========================================
// DISTRICT ADMIN PATIENT RECORDS API
// ========================================

app.use("/api/district/patients", districtPatientRoutes);

// ========================================
// DISTRICT ADMIN REFERRALS & APPOINTMENTS API
// ========================================

app.use("/api/district/referrals", referralRoutes);

// ========================================
// SERVER START
// ========================================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log("Aarogya Drishti APIs initialized");
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
