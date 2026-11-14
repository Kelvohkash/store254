import { z } from "zod";

export const BUSINESS_TYPE_VALUES = [
  "GENERAL",
  "RETAIL",
  "FASHION",
  "ELECTRONICS",
  "FURNITURE",
  "BEAUTY",
  "FOOD_BEVERAGE",
  "PHARMACY_HEALTH",
  "AUTOMOTIVE",
  "REAL_ESTATE",
  "AGRICULTURE",
  "BUILDING_HARDWARE",
  "SERVICES",
  "DIGITAL_TECH",
  "EDUCATION",
  "EVENTS_HOSPITALITY",
  "SPORTS_FITNESS",
  "KIDS_BABY",
  "WHOLESALE_B2B",
  "LOGISTICS_DELIVERY",
] as const;

export type BusinessTypeValue = (typeof BUSINESS_TYPE_VALUES)[number];

export const businessTypeSchema = z.enum(BUSINESS_TYPE_VALUES);
