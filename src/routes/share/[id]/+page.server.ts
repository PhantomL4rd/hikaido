import { publicResultCard } from "#lib/server/sharing";
import type { PageServerLoad } from "./$types";
export const load: PageServerLoad = async (e) => ({
  shared: await publicResultCard(e, e.params.id),
});
