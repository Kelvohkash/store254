import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export const RIDE_VEHICLE_TYPES = ["BODABODA", "TAXI"] as const;
export type RideVehicleType = (typeof RIDE_VEHICLE_TYPES)[number];

export const RIDE_DRIVER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export type RideDriverStatus = (typeof RIDE_DRIVER_STATUSES)[number];

export const RIDE_REQUEST_STATUSES = [
  "REQUESTED",
  "ACCEPTED",
  "ARRIVING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export type RideRequestStatus = (typeof RIDE_REQUEST_STATUSES)[number];

export const rideDrivers = sqliteTable(
  "ride_drivers",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull().unique(),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    mpesaPaymentInfo: text("mpesa_payment_info"),
    vehicleType: text("vehicle_type", { enum: ["BODABODA", "TAXI"] })
      .notNull()
      .default("BODABODA"),
    vehicleMakeModel: text("vehicle_make_model"),
    plateNumber: text("plate_number"),
    countyId: text("county_id"),
    locationId: text("location_id"),
    locationLabel: text("location_label"),
    isOnline: integer("is_online", { mode: "boolean" }).notNull().default(false),
    isBusy: integer("is_busy", { mode: "boolean" }).notNull().default(false),
    currentLat: real("current_lat"),
    currentLng: real("current_lng"),
    heading: real("heading"),
    lastLocationAt: integer("last_location_at", { mode: "timestamp" }),
    baseFareKes: integer("base_fare_kes").notNull().default(50),
    perKmRateKes: integer("per_km_rate_kes").notNull().default(35),
    ratingAvg: real("rating_avg").notNull().default(5.0),
    ratingCount: integer("rating_count").notNull().default(0),
    completedRides: integer("completed_rides").notNull().default(0),
    status: text("status", { enum: ["ACTIVE", "SUSPENDED"] })
      .notNull()
      .default("ACTIVE"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    onlineVehicleStatusIdx: index("ride_drivers_online_vehicle_status_idx").on(
      table.isOnline,
      table.vehicleType,
      table.status
    ),
  })
);

export const rideRequests = sqliteTable(
  "ride_requests",
  {
    id: text("id").primaryKey(),
    riderEmail: text("rider_email"),
    riderName: text("rider_name").notNull(),
    riderPhone: text("rider_phone").notNull(),
    vehicleType: text("vehicle_type", { enum: ["BODABODA", "TAXI"] })
      .notNull()
      .default("BODABODA"),
    driverId: text("driver_id").references(() => rideDrivers.id, { onDelete: "set null" }),
    pickupLabel: text("pickup_label").notNull(),
    pickupLat: real("pickup_lat").notNull(),
    pickupLng: real("pickup_lng").notNull(),
    pickupLocationId: text("pickup_location_id"),
    dropoffLabel: text("dropoff_label").notNull(),
    dropoffLat: real("dropoff_lat").notNull(),
    dropoffLng: real("dropoff_lng").notNull(),
    dropoffLocationId: text("dropoff_location_id"),
    distanceKm: real("distance_km").notNull(),
    estimatedFareKes: integer("estimated_fare_kes").notNull(),
    status: text("status", {
      enum: ["REQUESTED", "ACCEPTED", "ARRIVING", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
    })
      .notNull()
      .default("REQUESTED"),
    driverLat: real("driver_lat"),
    driverLng: real("driver_lng"),
    driverUpdatedAt: integer("driver_updated_at", { mode: "timestamp" }),
    trackingTokenHash: text("tracking_token_hash").notNull(),
    riderRating: integer("rider_rating"),
    riderReview: text("rider_review"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    statusVehicleDriverIdx: index("ride_requests_status_vehicle_driver_idx").on(
      table.status,
      table.vehicleType,
      table.driverId
    ),
    driverStatusIdx: index("ride_requests_driver_status_idx").on(table.driverId, table.status),
    riderEmailIdx: index("ride_requests_rider_email_idx").on(table.riderEmail),
  })
);

export type RideDriver = typeof rideDrivers.$inferSelect;
export type NewRideDriver = typeof rideDrivers.$inferInsert;
export type RideRequest = typeof rideRequests.$inferSelect;
export type NewRideRequest = typeof rideRequests.$inferInsert;
