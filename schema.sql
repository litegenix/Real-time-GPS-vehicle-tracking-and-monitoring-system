-- ─────────────────────────────────────────────────────────────────────────────
-- Vehicle Tracker Database Schema
-- Run: mysql -u root -p < schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS vehicle_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vehicle_tracker;

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    email        VARCHAR(150) NOT NULL UNIQUE,
    phone        VARCHAR(20),
    password     VARCHAR(255) NOT NULL,
    role         ENUM('user', 'fleet_manager') DEFAULT 'user',
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─── Vehicles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT NOT NULL,
    name             VARCHAR(100) NOT NULL,
    plate_number     VARCHAR(20)  NOT NULL,
    make             VARCHAR(50),
    model            VARCHAR(50),
    year             INT,
    color            VARCHAR(30),
    status           ENUM('active', 'parked', 'unauthorized', 'inactive') DEFAULT 'parked',
    speed_limit      DECIMAL(5,2) DEFAULT 120.00,
    tracking_enabled BOOLEAN DEFAULT TRUE,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

-- ─── Location History ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS location_history (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id  INT NOT NULL,
    latitude    DECIMAL(10, 8) NOT NULL,
    longitude   DECIMAL(11, 8) NOT NULL,
    speed       DECIMAL(6, 2) DEFAULT 0.00,   -- km/h
    heading     DECIMAL(5, 2) DEFAULT 0.00,   -- degrees
    accuracy    DECIMAL(6, 2) DEFAULT 0.00,   -- meters
    altitude    DECIMAL(8, 2) DEFAULT 0.00,   -- meters
    is_moving   BOOLEAN DEFAULT FALSE,
    timestamp   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    INDEX idx_vehicle_id (vehicle_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_vehicle_time (vehicle_id, timestamp)
);

-- ─── Trips ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trips (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id    INT NOT NULL,
    start_time    TIMESTAMP NOT NULL,
    end_time      TIMESTAMP,
    distance_km   DECIMAL(10, 3) DEFAULT 0.000,
    avg_speed     DECIMAL(6, 2) DEFAULT 0.00,
    max_speed     DECIMAL(6, 2) DEFAULT 0.00,
    start_address VARCHAR(255),
    end_address   VARCHAR(255),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    INDEX idx_vehicle_id (vehicle_id)
);

-- ─── Geofences ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geofences (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id      INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    center_lat      DECIMAL(10, 8) NOT NULL,
    center_lng      DECIMAL(11, 8) NOT NULL,
    radius          DECIMAL(10, 2) NOT NULL,   -- meters
    alert_on_enter  BOOLEAN DEFAULT TRUE,
    alert_on_exit   BOOLEAN DEFAULT TRUE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    INDEX idx_vehicle_id (vehicle_id)
);

-- ─── Alerts ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id  INT NOT NULL,
    user_id     INT NOT NULL,
    type        ENUM('speed', 'geofence_enter', 'geofence_exit', 'unauthorized', 'custom') NOT NULL,
    message     VARCHAR(255) NOT NULL,
    severity    ENUM('low', 'medium', 'high') DEFAULT 'medium',
    is_read     BOOLEAN DEFAULT FALSE,
    latitude    DECIMAL(10, 8),
    longitude   DECIMAL(11, 8),
    timestamp   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_vehicle_id (vehicle_id),
    INDEX idx_is_read (is_read)
);

-- ─── Geofence Events (log of entry/exit events) ──────────────────────────────
CREATE TABLE IF NOT EXISTS geofence_events (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    geofence_id INT NOT NULL,
    vehicle_id  INT NOT NULL,
    event_type  ENUM('enter', 'exit') NOT NULL,
    latitude    DECIMAL(10, 8) NOT NULL,
    longitude   DECIMAL(11, 8) NOT NULL,
    timestamp   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (geofence_id) REFERENCES geofences(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id)  REFERENCES vehicles(id)  ON DELETE CASCADE
);
