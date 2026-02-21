package com.vehicletracker.api;

import com.vehicletracker.models.Alert;
import com.vehicletracker.models.ApiResponse;
import com.vehicletracker.models.AuthResponse;
import com.vehicletracker.models.Geofence;
import com.vehicletracker.models.LocationUpdate;
import com.vehicletracker.models.LoginRequest;
import com.vehicletracker.models.RegisterRequest;
import com.vehicletracker.models.Trip;
import com.vehicletracker.models.Vehicle;

import java.util.List;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.DELETE;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.PUT;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface ApiService {

    // ─── AUTH ───────────────────────────────────────────────────────────────
    @POST("auth/register")
    Call<AuthResponse> register(@Body RegisterRequest request);

    @POST("auth/login")
    Call<AuthResponse> login(@Body LoginRequest request);

    @POST("auth/logout")
    Call<ApiResponse> logout();

    @GET("auth/profile")
    Call<ApiResponse> getProfile();

    // ─── VEHICLES ───────────────────────────────────────────────────────────
    @GET("vehicles")
    Call<List<Vehicle>> getMyVehicles();

    @GET("vehicles/{id}")
    Call<Vehicle> getVehicle(@Path("id") int vehicleId);

    @POST("vehicles")
    Call<Vehicle> addVehicle(@Body Vehicle vehicle);

    @PUT("vehicles/{id}")
    Call<Vehicle> updateVehicle(@Path("id") int vehicleId, @Body Vehicle vehicle);

    @DELETE("vehicles/{id}")
    Call<ApiResponse> deleteVehicle(@Path("id") int vehicleId);

    // ─── LOCATION ───────────────────────────────────────────────────────────
    @POST("location/update")
    Call<ApiResponse> updateLocation(@Body LocationUpdate locationUpdate);

    @GET("location/{vehicleId}/latest")
    Call<LocationUpdate> getLatestLocation(@Path("vehicleId") int vehicleId);

    @GET("location/{vehicleId}/history")
    Call<List<LocationUpdate>> getLocationHistory(
            @Path("vehicleId") int vehicleId,
            @Query("from") String fromDate,
            @Query("to") String toDate
    );

    // ─── TRIPS ──────────────────────────────────────────────────────────────
    @GET("trips/{vehicleId}")
    Call<List<Trip>> getTrips(@Path("vehicleId") int vehicleId);

    @GET("trips/{vehicleId}/{tripId}")
    Call<Trip> getTripDetail(
            @Path("vehicleId") int vehicleId,
            @Path("tripId") int tripId
    );

    // ─── GEOFENCES ──────────────────────────────────────────────────────────
    @GET("geofences/{vehicleId}")
    Call<List<Geofence>> getGeofences(@Path("vehicleId") int vehicleId);

    @POST("geofences")
    Call<Geofence> createGeofence(@Body Geofence geofence);

    @PUT("geofences/{id}")
    Call<Geofence> updateGeofence(@Path("id") int geofenceId, @Body Geofence geofence);

    @DELETE("geofences/{id}")
    Call<ApiResponse> deleteGeofence(@Path("id") int geofenceId);

    // ─── ALERTS ─────────────────────────────────────────────────────────────
    @GET("alerts")
    Call<List<Alert>> getAlerts(@Query("vehicleId") Integer vehicleId);

    @PUT("alerts/{id}/read")
    Call<ApiResponse> markAlertRead(@Path("id") int alertId);

    @DELETE("alerts/{id}")
    Call<ApiResponse> deleteAlert(@Path("id") int alertId);

    // ─── FLEET DASHBOARD ────────────────────────────────────────────────────
    @GET("fleet/summary")
    Call<ApiResponse> getFleetSummary();

    @GET("fleet/vehicles/all")
    Call<List<Vehicle>> getAllFleetVehicles();
}
