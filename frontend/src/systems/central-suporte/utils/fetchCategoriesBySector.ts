import { supabase } from "@suporte/integrations/supabase/client";

/**
 * Categorias vinculadas a um setor (via category_sectors); se nenhuma
 * estiver vinculada, cai para as categorias sem nenhum vínculo (disponíveis
 * a todos). Lógica idêntica repetida em NewTicket.tsx, NewTicketTI.tsx e
 * NewTicketChat.tsx antes desta extração — mesma query, mesmo fallback.
 */
export async function fetchCategoriesBySector(sectorId: string) {
  const { data: catSectors, error: csError } = await supabase
    .from("category_sectors")
    .select("category_id")
    .eq("sector_id", sectorId);
  if (csError) throw csError;

  if (!catSectors || catSectors.length === 0) {
    const { data: allLinked, error: allError } = await supabase
      .from("category_sectors")
      .select("category_id");
    if (allError) throw allError;
    const linkedIds = new Set((allLinked || []).map((c) => c.category_id));

    const { data: allCats, error: catError } = await supabase.from("categories").select("*").order("name");
    if (catError) throw catError;
    return (allCats || []).filter((c) => !linkedIds.has(c.id));
  }

  const categoryIds = catSectors.map((cs) => cs.category_id);
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .in("id", categoryIds)
    .order("name");
  if (error) throw error;
  return data;
}
