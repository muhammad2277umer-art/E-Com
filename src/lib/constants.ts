import type { BrandStatus, Marketplace, VendorType } from "@prisma/client";

export const FOLLOW_UP_AFTER_DAYS = 3;

export const STATUS_LABELS: Record<BrandStatus, string> = {
  UNTOUCHED: "UnTouched",
  EMAILED: "Emailed",
  FOLLOW_UP: "Follow Up",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const STATUS_STYLES: Record<BrandStatus, string> = {
  UNTOUCHED: "bg-slate-100 text-slate-700",
  EMAILED: "bg-blue-100 text-blue-700",
  FOLLOW_UP: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
};

export const VENDOR_LABELS: Record<VendorType, string> = {
  RETAILER: "Retailer",
  WHOLESALER: "Wholesaler",
  DISTRIBUTOR: "Distributor",
  MANUFACTURER: "Manufacturer",
  BRAND_OWNER: "Brand owner",
  DROPSHIPPER: "Dropshipper",
  OTHER: "Other",
};

export const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  AMAZON: "Amazon",
  WALMART: "Walmart",
  SHOPIFY: "Shopify",
  TIKTOK: "TikTok Shop",
  EBAY: "eBay",
  ETSY: "Etsy",
  OTHER: "Other",
};

export const STATUSES = Object.keys(STATUS_LABELS) as BrandStatus[];
export const VENDOR_TYPES = Object.keys(VENDOR_LABELS) as VendorType[];
export const MARKETPLACES = Object.keys(MARKETPLACE_LABELS) as Marketplace[];
