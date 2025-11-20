// api/server.js
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const Airtable = require('airtable');

const isProd = process.env.NODE_ENV === 'production';
const app = express();
const PORT = process.env.PORT || 3000;


// --- Airtable config ---
const {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_TABLE_NAME
} = process.env;

let airtableBase = null;
if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID && AIRTABLE_TABLE_NAME) {
  Airtable.configure({ apiKey: AIRTABLE_API_KEY });
  airtableBase = Airtable.base(AIRTABLE_BASE_ID);
  console.log('Airtable integration enabled');
} else {
  console.log('Airtable env not set, skipping Airtable integration');
}

// Kết nối Postgres
// const pool = new Pool({
//   host: process.env.PGHOST || 'db',
//   port: process.env.PGPORT || 5432,
//   database: process.env.PGDATABASE || 'landmap',
//   user: process.env.PGUSER || 'postgres',
//   password: process.env.PGPASSWORD || 'postgres',
// });

const pool = new Pool(
  isProd
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        host: process.env.PGHOST || 'db',
        port: process.env.PGPORT || 5432,
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'landmap',
      }
);

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

    // --- PUSH SANG AIRTABLE (fire-and-forget) ---
    if (airtableBase) {
      airtableBase(AIRTABLE_TABLE_NAME).create([
        {
          fields: {
            name: row.name,
            water_level: row.water_level,
            Lat: lat,
            Lng: lng,
            measured_at: row.measured_at
          }
        }
      ], (err) => {
        if (err) {
          console.error('Airtable create error:', err.message);
        }
      });
    }

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
