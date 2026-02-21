package com.vehicletracker.api;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKeys;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.concurrent.TimeUnit;

import okhttp3.Interceptor;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class ApiClient {

    // ─── Change this to your backend IP/domain ───────────────────────────────
    public static final String BASE_URL = "http://192.168.1.100:3000/api/";
    // ─────────────────────────────────────────────────────────────────────────

    private static Retrofit retrofit = null;
    private static ApiService apiService = null;

    private static SharedPreferences getSecurePrefs(Context context) {
        try {
            String masterKey = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC);
            return EncryptedSharedPreferences.create(
                    "secure_prefs",
                    masterKey,
                    context,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
        } catch (GeneralSecurityException | IOException e) {
            // Fallback to regular prefs in case of error
            return context.getSharedPreferences("secure_prefs", Context.MODE_PRIVATE);
        }
    }

    public static void saveToken(Context context, String token) {
        getSecurePrefs(context).edit().putString("jwt_token", token).apply();
    }

    public static String getToken(Context context) {
        return getSecurePrefs(context).getString("jwt_token", null);
    }

    public static void clearToken(Context context) {
        getSecurePrefs(context).edit().remove("jwt_token").apply();
    }

    public static ApiService getApiService(Context context) {
        if (apiService == null) {
            apiService = buildRetrofit(context).create(ApiService.class);
        }
        return apiService;
    }

    private static Retrofit buildRetrofit(Context context) {
        if (retrofit == null) {
            // Logging interceptor (disable in production)
            HttpLoggingInterceptor logging = new HttpLoggingInterceptor();
            logging.setLevel(HttpLoggingInterceptor.Level.BODY);

            // JWT Auth interceptor
            Interceptor authInterceptor = chain -> {
                Request original = chain.request();
                String token = getToken(context);

                Request.Builder builder = original.newBuilder()
                        .header("Content-Type", "application/json");

                if (token != null && !token.isEmpty()) {
                    builder.header("Authorization", "Bearer " + token);
                }

                return chain.proceed(builder.build());
            };

            OkHttpClient client = new OkHttpClient.Builder()
                    .addInterceptor(authInterceptor)
                    .addInterceptor(logging)
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .readTimeout(30, TimeUnit.SECONDS)
                    .writeTimeout(30, TimeUnit.SECONDS)
                    .build();

            retrofit = new Retrofit.Builder()
                    .baseUrl(BASE_URL)
                    .client(client)
                    .addConverterFactory(GsonConverterFactory.create())
                    .build();
        }
        return retrofit;
    }

    /** Call this when user logs out to force rebuild with fresh token */
    public static void reset() {
        retrofit = null;
        apiService = null;
    }
}
