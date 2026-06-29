export interface Goal {
  id: string;
  userId: string;
  title: string;
  domain: "academic" | "work" | "personal" | "health" | "social" | "family";
  createdAt: string; // ISO 8601 string
  lastResurfacedAt: string | null; // ISO 8601 string or null
  needsResurface: boolean;
  isActive: boolean;
}
