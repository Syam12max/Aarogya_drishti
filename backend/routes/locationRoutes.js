
const express = require("express");
const router = express.Router();

const { pool } = require("../db");

// 1. Get Districts
router.get("/districts", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, code, name_en, name_te
      FROM public.mst_districts
      WHERE is_active = TRUE
      ORDER BY name_en
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("District API Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch districts"
    });
  }
});

// 2. Get Mandals by District ID
router.get("/mandals/:districtId", async (req, res) => {
  try {
    const { districtId } = req.params;

    if (!/^\d+$/.test(districtId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid district ID"
      });
    }

    const result = await pool.query(
      `SELECT id, district_id, code, name_en, name_te
       FROM public.mst_mandals
       WHERE district_id = $1
       AND is_active = TRUE
       ORDER BY name_en`,
      [districtId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Mandal API Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch mandals"
    });
  }
});

// 3. Get Villages by Mandal ID
router.get("/villages/:mandalId", async (req, res) => {
  try {
    const { mandalId } = req.params;

    if (!/^\d+$/.test(mandalId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mandal ID"
      });
    }

    const result = await pool.query(
      `SELECT id, code, name_en, name_te, mandal_id
       FROM public.mst_villages
       WHERE mandal_id = $1
       AND is_active = TRUE
       AND code ~ '^[0-9]+$'
       ORDER BY name_en`,
      [mandalId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Village API Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch villages"
    });
  }
});

module.exports = router;
