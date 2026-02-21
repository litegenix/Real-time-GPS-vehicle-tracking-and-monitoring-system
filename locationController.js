const db = require('../config/db');

// ─── Update Location (called by Android app every ~10s) ──────────────────────
exports.updateLocation = async (req, res) => {
    const conn = await db.getConnection();
    try {
        const { vehicle_id, latitude, longitude, speed, heading, accuracy, altitude, is_moving } = req.body;
        const userId = req.user.userId;

        // Verify vehicle belongs to this user
        const [vehicles] = await conn.query(
            'SELECT id, speed_limit, status FROM vehicles WHERE id = ? AND user_id = ?',
            [vehicle_id, userId]
        );
        if (vehicles.length === 0) {
            return res.status(403).json({ success: false, message: 'Vehicle not found or unauthorized' });
        }

        const vehicle = vehicles[0];

        // Insert location record
        await conn.query(
            `INSERT INTO location_history
             (vehicle_id, latitude, longitude, speed, heading, accuracy, altitude, is_moving)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [vehicle_id, latitude, longitude, speed, heading, accuracy, altitude, is_moving]
        );

        // Update vehicle status
        const newStatus = is_moving ? 'active' : 'parked';
        await conn.query('UPDATE vehicles SET status = ? WHERE id = ?', [newStatus, vehicle_id]);

        // ─── Speed Alert ───────────────────────────────────────────────────
        const speedLimit = vehicle.speed_limit || 120;
        if (speed > speedLimit) {
            await createAlert(conn, {
                vehicle_id,
                user_id:  userId,
                type:     'speed',
                message:  `Speed alert: ${speed.toFixed(1)} km/h exceeds limit of ${speedLimit} km/h`,
                severity: speed > speedLimit * 1.3 ? 'high' : 'medium',
                latitude,
                longitude
            });
        }

        // ─── Geofence Check ───────────────────────────────────────────────
        await checkGeofences(conn, vehicle_id, userId, latitude, longitude);

        res.json({ success: true, message: 'Location updated' });

    } catch (err) {
        console.error('updateLocation error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        conn.release();
    }
};

// ─── Get Latest Location ─────────────────────────────────────────────────────
exports.getLatestLocation = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const [rows] = await db.query(
            `SELECT * FROM location_history
             WHERE vehicle_id = ?
             ORDER BY timestamp DESC LIMIT 1`,
            [vehicleId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'No location found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('getLatestLocation error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── Get Location History ─────────────────────────────────────────────────────
exports.getLocationHistory = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const { from, to }  = req.query;

        let query  = 'SELECT * FROM location_history WHERE vehicle_id = ?';
        let params = [vehicleId];

        if (from) { query += ' AND timestamp >= ?'; params.push(from); }
        if (to)   { query += ' AND timestamp <= ?'; params.push(to);   }
        query += ' ORDER BY timestamp ASC LIMIT 5000';

        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('getLocationHistory error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function createAlert(conn, alertData) {
    const { vehicle_id, user_id, type, message, severity, latitude, longitude } = alertData;
    // Deduplicate: don't create the same alert within 5 minutes
    const [recent] = await conn.query(
        `SELECT id FROM alerts
         WHERE vehicle_id = ? AND type = ?
           AND timestamp > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
        [vehicle_id, type]
    );
    if (recent.length > 0) return; // Already alerted recently

    await conn.query(
        `INSERT INTO alerts (vehicle_id, user_id, type, message, severity, latitude, longitude)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [vehicle_id, user_id, type, message, severity, latitude, longitude]
    );
}

async function checkGeofences(conn, vehicleId, userId, lat, lng) {
    const [geofences] = await conn.query(
        'SELECT * FROM geofences WHERE vehicle_id = ? AND is_active = TRUE',
        [vehicleId]
    );

    for (const geo of geofences) {
        const distance = haversineDistance(lat, lng, geo.center_lat, geo.center_lng);
        const isInside = distance <= geo.radius;

        // Get last event for this geofence
        const [lastEvent] = await conn.query(
            `SELECT event_type FROM geofence_events
             WHERE geofence_id = ? AND vehicle_id = ?
             ORDER BY timestamp DESC LIMIT 1`,
            [geo.id, vehicleId]
        );

        const lastType = lastEvent.length ? lastEvent[0].event_type : null;

        if (isInside && lastType !== 'enter') {
            // Entered geofence
            await conn.query(
                `INSERT INTO geofence_events (geofence_id, vehicle_id, event_type, latitude, longitude)
                 VALUES (?, ?, 'enter', ?, ?)`,
                [geo.id, vehicleId, lat, lng]
            );
            if (geo.alert_on_enter) {
                await createAlert(conn, {
                    vehicle_id: vehicleId,
                    user_id:    userId,
                    type:       'geofence_enter',
                    message:    `Vehicle entered geofence: ${geo.name}`,
                    severity:   'medium',
                    latitude:   lat,
                    longitude:  lng
                });
            }
        } else if (!isInside && lastType === 'enter') {
            // Exited geofence
            await conn.query(
                `INSERT INTO geofence_events (geofence_id, vehicle_id, event_type, latitude, longitude)
                 VALUES (?, ?, 'exit', ?, ?)`,
                [geo.id, vehicleId, lat, lng]
            );
            if (geo.alert_on_exit) {
                await createAlert(conn, {
                    vehicle_id: vehicleId,
                    user_id:    userId,
                    type:       'geofence_exit',
                    message:    `Vehicle exited geofence: ${geo.name}`,
                    severity:   'medium',
                    latitude:   lat,
                    longitude:  lng
                });
            }
        }
    }
}

/** Haversine formula – returns distance in meters */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R  = 6371000; // Earth radius in metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a  = Math.sin(Δφ/2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
