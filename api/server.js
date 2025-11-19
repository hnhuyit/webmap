// api/server.js
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Kết nối Postgres
const pool = new Pool({
  host: process.env.PGHOST || 'db',
  port: process.env.PGPORT || 5432,
  database: process.env.PGDATABASE || 'landmap',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
});

// Đọc JSON
app.use(express.json());

// Serve static (index.html)
app.use(express.static(path.join(__dirname, 'public')));

// ------- GET /api/places -------
app.get('/api/places', async (req, res) => {
  try {
    const sql = `
      SELECT
        id,
        name,
        water_level,
        measured_at,
        ST_AsGeoJSON(geom) AS geom
      FROM places
    `;
    const result = await pool.query(sql);

    const features = result.rows.map(row => ({
      type: 'Feature',
      geometry: JSON.parse(row.geom),
      properties: {
        id: row.id,
        name: row.name,
        water_level: row.water_level,
        measured_at: row.measured_at,
      },
    }));

    res.json({
      type: 'FeatureCollection',
      features,
    });
  } catch (err) {
    console.error('GET /api/places error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ------- POST /api/places -------
app.post('/api/places', async (req, res) => {
  try {
    const { name, water_level, lat, lng, measured_at } = req.body;

    if (!name || lat == null || lng == null) {
      console.warn('POST /api/places missing params:', req.body);
      return res.status(400).json({ error: 'Thiếu name/lat/lng' });
    }

    const waterLevelNum =
      water_level !== undefined && water_level !== null
        ? Number(water_level)
        : null;

    const measuredAt = measured_at ? new Date(measured_at) : new Date();

    const sql = `
      INSERT INTO places (name, geom, water_level, measured_at)
      VALUES (
        $1,
        ST_SetSRID(ST_MakePoint($2, $3), 4326),
        $4,
        $5
      )
      RETURNING
        id,
        name,
        water_level,
        measured_at,
        ST_AsGeoJSON(geom) AS geom
    `;

    const params = [name, lng, lat, waterLevelNum, measuredAt];
    const result = await pool.query(sql, params);
    const row = result.rows[0];

    const feature = {
      type: 'Feature',
      geometry: JSON.parse(row.geom),
      properties: {
        id: row.id,
        name: row.name,
        water_level: row.water_level,
        measured_at: row.measured_at,
      },
    };

    res.status(201).json(feature);
  } catch (err) {
    console.error('POST /api/places error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
