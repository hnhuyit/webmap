-- db/init.sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS places (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  geom geometry(Point, 4326) NOT NULL,
  water_level NUMERIC,          -- mực nước (cm)
  measured_at TIMESTAMP,        -- thời gian đo
  image_url TEXT                -- link hình ảnh (nếu có)
);

-- INSERT INTO places (name, geom) VALUES
-- ('Điểm A', ST_SetSRID(ST_MakePoint(109.196, 12.238), 4326)),
-- ('Điểm B', ST_SetSRID(ST_MakePoint(109.202, 12.240), 4326));

-- -- Thêm 100 điểm mẫu tại Nha Trang
-- INSERT INTO places (name, geom, water_level, measured_at)
-- SELECT
--   'Điểm ' || i AS name,
--   ST_SetSRID(
--     ST_MakePoint(
--       109.15 + (random() * 0.10),  -- kinh độ trong khoảng ~109.15–109.25
--       12.20 + (random() * 0.10)    -- vĩ độ trong khoảng ~12.20–12.30
--     ),
--     4326
--   ) AS geom,
--   CASE
--     WHEN i BETWEEN 1 AND 25 THEN                 -- 25 điểm: Thấp
--       ROUND(random() * 50)                       -- 0–50 cm
--     WHEN i BETWEEN 26 AND 50 THEN                -- 25 điểm: Trung bình
--       60 + ROUND(random() * 60)                  -- 60–120 cm
--     WHEN i BETWEEN 51 AND 75 THEN                -- 25 điểm: Cao
--       130 + ROUND(random() * 30)                 -- 130–160 cm
--     ELSE                                         -- 25 điểm: Rất cao
--       161 + ROUND(random() * 39)                 -- 161–200 cm
--   END AS water_level,
--   NOW() - (i || ' hours')::interval              -- thời gian đo: rải lùi theo giờ
-- FROM generate_series(1, 100) AS i;

-- Data mẫu 1000 điểm quanh khu đô thị Nha Trang
-- Dịch toàn bộ bbox sang trái khoảng 3km (≈ 0.0275 độ kinh tuyến)
INSERT INTO places (name, geom, water_level, measured_at)
SELECT
  'Điểm ' || i AS name,
  ST_SetSRID(
    ST_MakePoint(
      109.15 + (random() * 0.07) - 0.0275,  -- dịch ~3km về phía Tây
      12.18 + (random() * 0.12)            -- vĩ độ giữ nguyên
    ),
    4326
  ) AS geom,
  CASE
    WHEN i BETWEEN 1 AND 250 THEN
      ROUND(random() * 50)                 -- 0–50 cm
    WHEN i BETWEEN 251 AND 500 THEN
      60 + ROUND(random() * 60)            -- 60–120 cm
    WHEN i BETWEEN 501 AND 750 THEN
      130 + ROUND(random() * 30)           -- 130–160 cm
    ELSE
      161 + ROUND(random() * 39)           -- 161–200 cm
  END AS water_level,
  NOW() - ((i % 168) || ' hours')::interval
FROM generate_series(1, 1000) AS i;
