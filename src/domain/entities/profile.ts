export type UserRole = "customer" | "admin";

export interface SavedAddress {
  readonly phone: string | null;
  readonly address: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly country: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
}

export interface Profile {
  readonly id: string;
  readonly fullName: string | null;
  readonly avatarUrl: string | null;
  readonly role: UserRole;
  readonly createdAt: string;
  readonly address: SavedAddress;
}

export function isAdmin(profile: Profile | null | undefined): boolean {
  return profile?.role === "admin";
}
