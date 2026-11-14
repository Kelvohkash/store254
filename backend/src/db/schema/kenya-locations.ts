import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * 47 Kenyan Counties (IEBC / ISO administrative boundaries)
 */
export const kenyaCounties = sqliteTable(
  "kenya_counties",
  {
    id: text("id").primaryKey(),
    code: integer("code").notNull().unique(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    centroidLat: real("centroid_lat").notNull(),
    centroidLng: real("centroid_lng").notNull(),
  },
  (table) => ({
    nameIdx: index("kenya_counties_name_idx").on(table.name),
  })
);

/**
 * 290 Kenyan Constituencies mapped to their parent County
 */
export const kenyaConstituencies = sqliteTable(
  "kenya_constituencies",
  {
    id: text("id").primaryKey(),
    code: integer("code").notNull().unique(),
    countyId: text("county_id")
      .notNull()
      .references(() => kenyaCounties.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    centroidLat: real("centroid_lat").notNull(),
    centroidLng: real("centroid_lng").notNull(),
  },
  (table) => ({
    countyIdx: index("kenya_constituencies_county_idx").on(table.countyId),
    slugIdx: index("kenya_constituencies_slug_idx").on(table.slug),
  })
);

/**
 * Towns, Estates, Markets, and Shopping Centres across Kenya.
 * Base rows are open-licensed GeoNames points assigned to IEBC polygons;
 * additional centres may be linked on demand via Google Maps Place ID or merchant input.
 */
export const kenyaLocations = sqliteTable(
  "kenya_locations",
  {
    id: text("id").primaryKey(),
    countyId: text("county_id")
      .notNull()
      .references(() => kenyaCounties.id, { onDelete: "cascade" }),
    constituencyId: text("constituency_id")
      .notNull()
      .references(() => kenyaConstituencies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    kind: text("kind", {
      enum: ["TOWN", "ESTATE", "SHOPPING_CENTRE", "TRADING_CENTRE"],
    })
      .notNull()
      .default("TRADING_CENTRE"),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    source: text("source", {
      enum: ["GEONAMES", "GOOGLE_MAPS", "MERCHANT"],
    })
      .notNull()
      .default("GEONAMES"),
    googlePlaceId: text("google_place_id"),
    population: integer("population").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    countyIdx: index("kenya_locations_county_idx").on(table.countyId),
    constituencyIdx: index("kenya_locations_constituency_idx").on(table.constituencyId),
    nameIdx: index("kenya_locations_name_idx").on(table.name),
    placeIdIdx: index("kenya_locations_place_id_idx").on(table.googlePlaceId),
  })
);

/**
 * Smart proximity graph connecting each town/shopping centre to its nearest neighbors.
 * Enables zero-result / low-result searches to automatically expand to adjacent centres.
 */
export const kenyaLocationNeighbors = sqliteTable(
  "kenya_location_neighbors",
  {
    locationId: text("location_id")
      .notNull()
      .references(() => kenyaLocations.id, { onDelete: "cascade" }),
    neighborLocationId: text("neighbor_location_id")
      .notNull()
      .references(() => kenyaLocations.id, { onDelete: "cascade" }),
    distanceKm: real("distance_km").notNull(),
    rank: integer("rank").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.locationId, table.neighborLocationId] }),
    locationRankIdx: index("kenya_loc_neighbors_rank_idx").on(table.locationId, table.rank),
  })
);

export type KenyaCounty = typeof kenyaCounties.$inferSelect;
export type KenyaConstituency = typeof kenyaConstituencies.$inferSelect;
export type KenyaLocation = typeof kenyaLocations.$inferSelect;
export type KenyaLocationNeighbor = typeof kenyaLocationNeighbors.$inferSelect;
