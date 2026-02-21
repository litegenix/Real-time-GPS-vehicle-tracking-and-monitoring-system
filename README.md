# 🚗 Android Vehicle Tracking & Monitoring App
> Java · Android · Node.js REST API · MySQL

---

## Project Structure

```
VehicleTracker/
│
├── app/                                  ← Android Application
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/vehicletracker/
│       │   ├── activities/
│       │   │   ├── SplashActivity.java
│       │   │   ├── LoginActivity.java        ← FR1: Authentication
│       │   │   ├── RegisterActivity.java     ← FR1: Authentication
│       │   │   ├── MainActivity.java         ← Hub with bottom navigation
│       │   │   ├── VehicleDetailActivity.java← FR6: Multi-vehicle management
│       │   │   ├── AddVehicleActivity.java   ← FR6: Register vehicles
│       │   │   ├── GeofenceActivity.java     ← FR3: Virtual boundaries
│       │   │   ├── TripHistoryActivity.java  ← FR4: Trip replay
│       │   │   ├── AlertsActivity.java       ← FR5,FR7: Speed + auth alerts
│       │   │   └── FleetDashboardActivity.java ← FR10: Fleet management
│       │   ├── fragments/
│       │   │   ├── MapFragment.java          ← FR2: Live map tracking
│       │   │   ├── VehiclesFragment.java     ← FR6: Vehicle list
│       │   │   ├── AlertsFragment.java       ← FR5,FR7: Alert list
│       │   │   └── ProfileFragment.java
│       │   ├── api/
│       │   │   ├── ApiClient.java            ← Retrofit + JWT interceptor
│       │   │   └── ApiService.java           ← All API endpoints
│       │   ├── models/
│       │   │   ├── Vehicle.java
│       │   │   ├── LocationUpdate.java
│       │   │   └── Models.java               ← Auth, Alert, Geofence, Trip
│       │   ├── services/
│       │   │   └── LocationTrackingService.java ← FR2: Background GPS service
│       │   ├── receivers/
│       │   │   ├── GeofenceBroadcastReceiver.java ← FR3: Geofence events
│       │   │   └── BootReceiver.java         ← Restart service after reboot
│       │   └── utils/
│       │       └── SessionManager.java       ← Login state management
│       └── res/
│           ├── layout/                       ← XML UI layouts
│           ├── menu/bottom_nav_menu.xml
│           └── values/ (colors, strings)
│
├── backend/                              ← Node.js REST API
│   ├── server.js                         ← Express app + all routes
│   ├── schema.sql                        ← MySQL database schema
│   ├── package.json
│   ├── .env                              ← Configuration (DB, JWT, etc.)
│   └── config/
│       ├── db.js                         ← MySQL connection pool
│   └── controllers/
│       ├── authController.js             ← Register, login, profile
│       ├── vehicleController.js          ← CRUD for vehicles
│       └── locationController.js        ← GPS updates + geofence checks
```

---

## Functional Requirements Coverage

| FR  | Requirement              | Implementation                                    |
|-----|--------------------------|---------------------------------------------------|
| FR1 | User authentication      | LoginActivity → `/api/auth/login` + JWT           |
| FR2 | Live GPS tracking        | LocationTrackingService (FusedLocationProvider)   |
| FR3 | Geofencing + alerts      | GeofenceActivity + locationController.js Haversine|
| FR4 | Trip history & replay    | TripHistoryActivity + `/api/trips/:vehicleId`     |
| FR5 | Speed alerts             | locationController.js checks speed vs limit       |
| FR6 | Multiple vehicles        | VehiclesFragment + AddVehicleActivity             |
| FR7 | Unauthorized movement    | Alert created when movement detected unexpectedly |
| FR9 | Cloud storage            | MySQL via REST API                                |
| FR10| Fleet dashboard          | FleetDashboardActivity + `/api/fleet/summary`     |

---

## Setup Instructions

### 1. Backend (Node.js + MySQL)

```bash
# Install MySQL and create database
mysql -u root -p < backend/schema.sql

# Install Node dependencies
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env → set DB_PASSWORD and JWT_SECRET

# Start server
npm run dev          # development (auto-restart)
npm start            # production
```

Server runs at `http://localhost:3000`

### 2. Android App

**Step 1: Get a Google Maps API Key**
- Go to https://console.cloud.google.com
- Enable "Maps SDK for Android"
- Create an API key and add it to `local.properties`:
  ```
  MAPS_API_KEY=your_key_here
  ```

**Step 2: Configure Backend URL**
- Open `app/src/main/java/com/vehicletracker/api/ApiClient.java`
- Change `BASE_URL` to your backend server IP:
  ```java
  public static final String BASE_URL = "http://YOUR_SERVER_IP:3000/api/";
  ```
  > Use your local machine's IP address (e.g. 192.168.1.100) — NOT localhost,
  > because the Android emulator has its own network namespace.
  > Use `10.0.2.2` if testing on the default Android Emulator.

**Step 3: Open in Android Studio**
- File → Open → select the `VehicleTracker/` folder
- Let Gradle sync
- Run on emulator or physical device (API 24+)

---

## API Endpoints Reference

| Method | Endpoint                          | Auth | Description               |
|--------|-----------------------------------|------|---------------------------|
| POST   | /api/auth/register                | No   | Create account            |
| POST   | /api/auth/login                   | No   | Login, get JWT token      |
| GET    | /api/auth/profile                 | Yes  | Get current user          |
| GET    | /api/vehicles                     | Yes  | Get all my vehicles       |
| POST   | /api/vehicles                     | Yes  | Register new vehicle      |
| PUT    | /api/vehicles/:id                 | Yes  | Update vehicle            |
| DELETE | /api/vehicles/:id                 | Yes  | Delete vehicle            |
| POST   | /api/location/update              | Yes  | Send GPS update (FR2)     |
| GET    | /api/location/:vehicleId/latest   | Yes  | Get last known position   |
| GET    | /api/location/:vehicleId/history  | Yes  | Get trip history (FR4)    |
| GET    | /api/geofences/:vehicleId         | Yes  | List geofences            |
| POST   | /api/geofences                    | Yes  | Create geofence (FR3)     |
| GET    | /api/alerts                       | Yes  | Get all alerts            |
| PUT    | /api/alerts/:id/read              | Yes  | Mark alert as read        |
| GET    | /api/fleet/summary                | Yes  | Fleet stats (FR10)        |

---

## Key Technical Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Location API | FusedLocationProviderClient | Better accuracy + battery life vs raw GPS |
| Auth | JWT (7-day expiry) | Stateless, easy to implement on mobile |
| Token storage | EncryptedSharedPreferences | Secure on-device storage |
| Map polling | Every 15 seconds | Balance between real-time and battery/data |
| Geofence detection | Server-side Haversine | Works even when app is closed |
| Speed dedup | 5-minute cooldown | Prevent alert spam on sustained high speed |

---

## Adding Features (Next Steps)

1. **Push Notifications** — Integrate FCM to push alerts from server to device
2. **Trip auto-detection** — Auto-start/end trips based on movement detection
3. **Offline support** — Queue location updates locally when no network
4. **Route optimization** — Use Google Directions API for route suggestions (FR10)
5. **Fuel tracking** — Add fuel log table and consumption estimates
