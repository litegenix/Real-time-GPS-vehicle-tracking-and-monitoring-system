package com.vehicletracker.services;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.vehicletracker.R;
import com.vehicletracker.activities.MainActivity;
import com.vehicletracker.api.ApiClient;
import com.vehicletracker.api.ApiService;
import com.vehicletracker.models.ApiResponse;
import com.vehicletracker.models.LocationUpdate;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LocationTrackingService extends Service {

    private static final String TAG = "LocationTrackingService";
    public  static final String CHANNEL_ID     = "vehicle_tracking_channel";
    public  static final String ACTION_START   = "START_TRACKING";
    public  static final String ACTION_STOP    = "STOP_TRACKING";
    public  static final String EXTRA_VEHICLE_ID = "vehicle_id";

    // Update interval: every 10 seconds while moving, every 60 seconds parked
    private static final long UPDATE_INTERVAL_MS     = 10_000;
    private static final long FASTEST_INTERVAL_MS    = 5_000;

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private ApiService apiService;
    private int currentVehicleId = -1;
    private Location lastLocation;

    @Override
    public void onCreate() {
        super.onCreate();
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        apiService          = ApiClient.getApiService(this);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        if (ACTION_START.equals(action)) {
            currentVehicleId = intent.getIntExtra(EXTRA_VEHICLE_ID, -1);
            startForeground(1, buildNotification("Tracking vehicle..."));
            startLocationUpdates();
        } else if (ACTION_STOP.equals(action)) {
            stopTracking();
        }
        return START_STICKY;
    }

    private void startLocationUpdates() {
        LocationRequest locationRequest = new LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, UPDATE_INTERVAL_MS)
                .setMinUpdateIntervalMillis(FASTEST_INTERVAL_MS)
                .setMinUpdateDistanceMeters(5f) // Only update if moved 5+ meters
                .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult result) {
                if (result == null || currentVehicleId == -1) return;

                Location location = result.getLastLocation();
                if (location == null) return;

                boolean isMoving = false;
                if (lastLocation != null) {
                    float distance = lastLocation.distanceTo(location);
                    isMoving = distance > 2; // moving if 2+ meters from last point
                }
                lastLocation = location;

                // Build and send location update to backend
                LocationUpdate update = new LocationUpdate(
                        currentVehicleId,
                        location.getLatitude(),
                        location.getLongitude(),
                        location.getSpeed() * 3.6, // m/s → km/h
                        location.getBearing(),
                        location.getAccuracy(),
                        location.getAltitude(),
                        isMoving
                );
                sendLocationToBackend(update);
            }
        };

        try {
            fusedLocationClient.requestLocationUpdates(
                    locationRequest, locationCallback, Looper.getMainLooper());
        } catch (SecurityException e) {
            Log.e(TAG, "Location permission not granted", e);
            stopSelf();
        }
    }

    private void sendLocationToBackend(LocationUpdate update) {
        apiService.updateLocation(update).enqueue(new Callback<ApiResponse>() {
            @Override
            public void onResponse(Call<ApiResponse> call, Response<ApiResponse> response) {
                if (!response.isSuccessful()) {
                    Log.w(TAG, "Location update failed: " + response.code());
                }
            }
            @Override
            public void onFailure(Call<ApiResponse> call, Throwable t) {
                Log.e(TAG, "Failed to send location: " + t.getMessage());
                // TODO: Queue locally and retry when network recovers
            }
        });
    }

    private void stopTracking() {
        if (locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        stopForeground(true);
        stopSelf();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Vehicle Tracking",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows while actively tracking a vehicle");
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private Notification buildNotification(String contentText) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, notificationIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Vehicle Tracker")
                .setContentText(contentText)
                .setSmallIcon(R.drawable.ic_car)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
    }

    // ─── Static Helpers ──────────────────────────────────────────────────────
    public static Intent buildStartIntent(android.content.Context ctx, int vehicleId) {
        Intent intent = new Intent(ctx, LocationTrackingService.class);
        intent.setAction(ACTION_START);
        intent.putExtra(EXTRA_VEHICLE_ID, vehicleId);
        return intent;
    }

    public static Intent buildStopIntent(android.content.Context ctx) {
        Intent intent = new Intent(ctx, LocationTrackingService.class);
        intent.setAction(ACTION_STOP);
        return intent;
    }
}
