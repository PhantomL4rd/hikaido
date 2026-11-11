import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = () => {
  redirect(303, "https://contact.pl4rd.com/?service=hikaido", {
    external: ["https://contact.pl4rd.com"],
  });
};
