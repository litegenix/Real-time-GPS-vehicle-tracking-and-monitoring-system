require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const jwt     = require('jsonwebtoken');
const db      = require('./config/db');

// Controllers
const authController     = require('./controllers/authController');
const vehicleController  = require('./controllers/vehicleController');
const locationController = require('./controllers/locationController');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── JWT Auth Middleware ──────────────────────────────────────────────────────
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
};

// ─── Auth Routes ─────────────────────────────────────────────────────────────
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login',    authController.login);
app.post('/api/auth/logout',   authenticate, authController.logout);
app.get( '/api/auth/profile',  authenticate, authController.getProfile);

// ─── Vehicle Routes ───────────────────────────────────────────────────────────
app.get(   '/api/vehicles',     authenticate, vehicleController.getMyVehicles);
app.get(   '/api/vehicles/:id', authenticate, vehicleController.getVehicle);
app.post(  '/api/vehicles',     authenticate, vehicleController.addVehicle);
app.put(   '/api/vehicles/:id', authenticate, vehicleController.updateVehicle);
app.delete('/api/vehicles/:id', authenticate, vehicleController.deleteVehicle);

// ─── Location Routes ──────────────────────────────────────────────────────────
app.post('/api/location/update',               authenticate, locationController.updateLocation);
app.get( '/api/location/:vehicleId/latest',    authenticate, locationController.getLatestLocation);
app.get( '/api/location/:vehicleId/history',   authenticate, locationController.getLocationHistory);

// ─── Alerts Routes ────────────────────────────────────────────────────────────
app.get('/api/alerts', authenticate, async (req, res) => {
    try {
        const { vehicleId } = req.query;
        let query  = `SELECT a.*, v.name AS vehicle_name, v.plate_number
                      FROM alerts a
                      JOIN vehicles v ON v.id = a.vehicle_id
                      WHERE a.user_id = ?`;
        let params = [req.user.userId];
        if (vehicleId) { query += ' AND a.vehicle_id = ?'; params.push(vehicleId); }
        query += ' ORDER BY a.timestamp DESC LIMIT 100';
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
});

app.put('/api/alerts/:id/read', authenticate, async (req, res) => {
    try {
        await db.query('UPDATE alerts SET is_read = TRUE WHERE id = ? AND user_id = ?',
                       [req.params.id, req.user.userId]);
        res.json({ success: true, message: 'Alert marked as read' });
    } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
});

app.delete('/api/alerts/:id', authenticate, async (req, res) => {
    try {
        await db.query('DELETE FROM alerts WHERE id = ? AND user_id = ?',
                       [req.params.id, req.user.userId]);
        res.json({ success: true, message: 'Alert deleted' });
    } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// ─── Geofence Routes ──────────────────────────────────────────────────────────
app.get('/api/geofences/:vehicleId', authenticate, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM geofences WHERE vehicle_id = ? ORDER BY created_at DESC',
            [req.params.vehicleId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
});

app.post('/api/geofences', authenticate, async (req, res) => {
    try {
        const { vehicle_id, name, center_lat, center_lng, radius, alert_on_enter, alert_on_exit } = req.body;
        const [result] = await db.query(
            `INSERT INTO geofences (vehicle_id, name, center_lat, center_lng, radius, alert_on_enter, alert_on_exit)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [vehicle_id, name, center_lat, center_lng, radius, alert_on_enter ?? true, alert_on_exit ?? true]
        );
        const [geo] = await db.query('SELECT * FROM geofences WHERE id = ?', [result.insertId]);
        res.status(201).json(geo[0]);
    } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
});

app.put('/api/geofences/:id', authenticate, async (req, res) => {
    try {
        const { name, radius, alert_on_enter, alert_on_exit, is_active } = req.body;
        await db.query(
            'UPDATE geofences SET name=?, radius=?, alert_on_enter=?, alert_on_exit=?, is_active=? WHERE id=?',
            [name, radius, alert_on_enter, alert_on_exit, is_active, req.params.id]
        );
        const [geo] = await db.query('SELECT * FROM geofences WHERE id = ?', [req.params.id]);
        res.json(geo[0]);
    } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
});

app.delete('/api/geofences/:id', authenticate, async (req, res) => {
    try {
        await db.query('DELETE FROM geofences WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Geofence deleted' });
    } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// ─── Trips Routes ─────────────────────────────────────────────────────────────
app.get('/api/trips/:vehicleId', authenticate, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM trips WHERE vehicle_id = ? ORDER BY start_time DESC',
            [req.params.vehicleId]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// ─── Fleet Dashboard ──────────────────────────────────────────────────────────
app.get('/api/fleet/summary', authenticate, async (req, res) => {
    try {
        const uid = req.user.userId;
        const [[stats]] = await db.query(
            `SELECT
               COUNT(*) AS total_vehicles,
               SUM(status = 'active')       AS active_vehicles,
               SUM(status = 'parked')       AS parked_vehicles,
               SUM(status = 'unauthorized') AS unauthorized_vehicles
             FROM vehicles WHERE user_id = ?`, [uid]
        );
        const [[unreadAlerts]] = await db.query(
            'SELECT COUNT(*) AS count FROM alerts WHERE user_id = ? AND is_read = FALSE', [uid]
        );
        res.json({ success: true, data: { ...stats, unread_alerts: unreadAlerts.count } });
    } catch (err) { res.status(500).json({ success: false, message: 'Server error' }); }
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 Vehicle Tracker API running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
