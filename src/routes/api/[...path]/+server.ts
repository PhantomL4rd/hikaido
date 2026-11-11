import { error, json, type RequestHandler } from "@sveltejs/kit";
import {
  contact,
  manage,
  publish,
  remove,
  report,
  respondents,
  result,
  submit,
} from "#lib/server/service";
import { shareResult } from "#lib/server/sharing";
export const GET: RequestHandler = async (e) => {
  const [resource, id, action, rid] = e.params.path!.split("/");
  if (resource === "quizzes" && id) {
    if (action === "responses") return json(await respondents(e, id));
    if (action === "result" && rid) return json(await result(e, id, rid));
    if (action === "manage") return json(await manage(e, id));
  }
  error(404);
};
export const POST: RequestHandler = async (e) => {
  const [resource, id, action, rid, operation] = e.params.path!.split("/");
  if (resource === "quizzes") {
    if (id && action === "result" && rid && operation === "share")
      return json(await shareResult(e, id, rid), { status: 201 });
    if (!id) return json(await publish(e), { status: 201 });
    if (action === "responses")
      return json(await submit(e, id), { status: 201 });
  }
  if (resource === "reports") return json(await report(e), { status: 201 });
  if (resource === "contacts") return json(await contact(e), { status: 201 });
  error(404);
};
export const DELETE: RequestHandler = async (e) => {
  const [resource, id, action, rid] = e.params.path!.split("/");
  if (
    resource === "quizzes" &&
    id &&
    (!action || (action === "responses" && rid))
  )
    return json(await remove(e, id, rid));
  error(404);
};
