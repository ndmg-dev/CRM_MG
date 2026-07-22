import { useQuery } from "@tanstack/react-query";
import { supabase } from "@suporte/integrations/supabase/client";

const COORDINATOR_ROLES = ["coordinator", "coordinator_sp", "coordinator_sc", "coordinator_sf", "coordinator_fn", "coordinator_rh"];

const COORDINATOR_SECTOR_MAP: Record<string, string> = {
  coordinator: "TI",
  coordinator_sp: "SP",
  coordinator_sc: "SC",
  coordinator_sf: "SF",
  coordinator_fn: "FN",
  coordinator_rh: "RH",
};

const ALL_STAFF_ROLES = [
  "support_agent", "dev", "admin_ti", "coordinator", "viewer",
  "coordinator_sp", "coordinator_sc", "coordinator_sf", "coordinator_fn", "coordinator_rh",
  "direction", "dp", "fiscal", "contabil", "financeiro", "societario", "recepcao", "rh",
];

export interface UserSectorContext {
  userId: string | null;
  roles: string[];
  sectorId: string | null;
  sectorName: string | null;
  isAdmin: boolean;
  isDirection: boolean;
  isCoordinator: boolean;
  isViewer: boolean;
  isStaff: boolean;
  /** Can see all sectors (admin, direction, viewer) */
  canSeeAllSectors: boolean;
  /** The sector this user's view is limited to (null = all) */
  visibleSectorId: string | null;
}

export function useUserSector(): UserSectorContext {
  const { data: userId } = useQuery({
    queryKey: ["current-user-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return data?.map((r) => r.role) || [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["user-profile-sector", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("sector_id, sectors:sector_id(name)")
        .eq("id", userId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!userId,
  });

  const userRoles = roles || [];
  const isAdmin = userRoles.includes("admin_ti");
  const isDirection = userRoles.includes("direction");
  const isViewer = userRoles.includes("viewer");
  const isCoordinator = userRoles.some(r => COORDINATOR_ROLES.includes(r));
  const isStaff = userRoles.some(r => ALL_STAFF_ROLES.includes(r));
  const canSeeAllSectors = isDirection;

  const sectorId = profile?.sector_id || null;
  const sectorName = (profile?.sectors as any)?.name || null;

  // Determine visible sector
  let visibleSectorId: string | null = null;
  if (!canSeeAllSectors) {
    visibleSectorId = sectorId;
  }

  return {
    userId: userId || null,
    roles: userRoles,
    sectorId,
    sectorName,
    isAdmin,
    isDirection,
    isCoordinator,
    isViewer,
    isStaff,
    canSeeAllSectors,
    visibleSectorId,
  };
}

