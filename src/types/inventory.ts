export type Category = "motorcycles" | "atv_sxs" | "rv_marine" | "golf";
export type Status = "unreviewed" | "interested" | "maybe" | "pass";

export interface InventoryItem {
  id: string;
  itemNumber: string;
  category: Category;
  title: string;
  year: number | null;
  make: string;
  model: string;
  milesHours: string | null;
  crScore: number | null;
  docs: string | null;
  location: string;
  photoUrl: string | null;
  sourceUrl: string;
  status: Status;
  note: string;
  maxBid: number | null;
  buddyTag: string | null;
  updatedAt: number;
}

export interface CSVRow {
  [key: string]: string;
}
