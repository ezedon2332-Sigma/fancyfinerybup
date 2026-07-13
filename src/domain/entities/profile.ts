export type UserRole = "customer" | "admin";

export interface Profile {
  readonly id: string;
  readonly fullName: string | null;
  readonly avatarUrl: string | null;
  readonly role: UserRole;
  readonly createdAt: string;
}

export function isAdmin(profile: Profile | null | undefined): boolean {
  return profile?.role === "admin";
}
