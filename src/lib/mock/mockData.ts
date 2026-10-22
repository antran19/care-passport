export interface MockUser {
  id: string;
  username: string;
  name: string;
  role: "patient" | "gp" | "physio" | "admin";
  realmRoles: string[];
  groups: string[];
}

export const MOCK_USERS: Record<string, MockUser> = {
  patient1: {
    id: "user-patient-001",
    username: "patient1",
    name: "Nguyen Van A (Patient)",
    role: "patient",
    realmRoles: ["_tide_encryptor", "_tide_decryptor", "_tide_enabled"],
    groups: ["/p1-owner"],
  },
  gp1: {
    id: "user-gp-001",
    username: "gp1",
    name: "Dr. Le Minh (GP)",
    role: "gp",
    realmRoles: ["_tide_decryptor", "_tide_enabled"],
    groups: ["/p1-care-team"],
  },
  physio1: {
    id: "user-physio-001",
    username: "physio1",
    name: "Dr. Tran Thi (Physio)",
    role: "physio",
    realmRoles: ["_tide_decryptor", "_tide_enabled"],
    groups: [], // Not yet granted care team membership
  },
  admin1: {
    id: "user-admin-001",
    username: "admin1",
    name: "Care Steward (Admin)",
    role: "admin",
    realmRoles: ["tide-realm-admin", "_tide_enabled"],
    groups: [],
  },
};
