import { spawnSync } from "node:child_process";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const a = args.filter((x) => x !== "--remote");
const [resource, action, id] = a;
function execute(query: string) {
  const r = spawnSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "execute",
      "DB",
      remote ? "--remote" : "--local",
      "--command",
      query,
      "--json",
    ],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  if (r.status !== 0) throw new Error(r.stderr || "D1 command failed");
  return JSON.parse(r.stdout) as { results: Record<string, unknown>[] }[];
}
function literal(s: string) {
  return `'${s.replaceAll("'", "''")}'`;
}
const target = id ? literal(id) : "";
async function confirm() {
  const rl = createInterface({ input: stdin, output: stdout });
  const result = await rl.question(
    `${remote ? "REMOTE" : "LOCAL"} ${resource} ${action} ${id || ""} を実行します。yes と入力: `,
  );
  rl.close();
  if (result !== "yes") process.exit(1);
}
async function main() {
  let query = "";
  if (action === "delete" || action === "hide") await confirm();
  if (resource === "reports" && action === "list")
    query = "SELECT * FROM reports ORDER BY created_at DESC LIMIT 100";
  else if (resource === "reports" && action === "resolve" && id)
    query = `UPDATE reports SET status='resolved' WHERE id=${target} RETURNING *`;
  else if (resource === "quiz" && action === "inspect" && id) {
    query = `SELECT id,character_name,question_count,hikansen_type,status,created_at FROM quizzes WHERE id=${target}; SELECT id,position,question_snapshot,choice_a_snapshot,choice_b_snapshot,correct_choice FROM questions WHERE quiz_id=${target} ORDER BY position; SELECT count(*) AS response_count FROM responses WHERE quiz_id=${target}`;
  } else if (resource === "quiz" && action === "hide" && id)
    query = `UPDATE quizzes SET status='hidden' WHERE id=${target}`;
  else if (resource === "quiz" && action === "delete" && id)
    query = `DELETE FROM quizzes WHERE id=${target}`;
  else if (resource === "response" && action === "delete" && id)
    query = `DELETE FROM responses WHERE id=${target}`;
  else if (resource === "contacts" && action === "list")
    query =
      "SELECT id,category,created_at FROM contacts ORDER BY created_at DESC LIMIT 100";
  else if (resource === "contacts" && action === "inspect" && id)
    query = `SELECT * FROM contacts WHERE id=${target}`;
  else if (resource === "notifications" && action === "retry") {
    const webhook = process.env.SLACK_WEBHOOK_URL;
    if (!webhook) {
      console.log("SLACK_WEBHOOK_URL未設定。Outboxは保持されます。");
      return;
    }
    const rows = execute(
      "SELECT * FROM notification_outbox WHERE status != 'delivered' AND (lease_until IS NULL OR lease_until < " +
        Date.now() +
        ") ORDER BY created_at LIMIT 20",
    )[0].results;
    for (const row of rows) {
      const claim = crypto.randomUUID();
      const rows = execute(
        `UPDATE notification_outbox SET status='sending',attempts=attempts+1,lease_until=${Date.now() + 60000},last_error=${literal(claim)} WHERE id=${literal(String(row.id))} AND status!='delivered' AND (lease_until IS NULL OR lease_until<${Date.now()}) RETURNING id`,
      )[0].results;
      if (!rows.length) continue;
      try {
        const text = String(row.payload)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll("@", "＠");
        const r = await fetch(webhook, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text,
            mrkdwn: false,
            link_names: 0,
            unfurl_links: false,
            unfurl_media: false,
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) throw new Error();
        execute(
          `UPDATE notification_outbox SET status='delivered',delivered_at=${Date.now()},lease_until=NULL,last_error=NULL WHERE id=${literal(String(row.id))} AND last_error=${literal(claim)}`,
        );
      } catch {
        execute(
          `UPDATE notification_outbox SET status='pending',lease_until=${Date.now() + 60000},last_error='Slack delivery failed' WHERE id=${literal(String(row.id))} AND last_error=${literal(claim)}`,
        );
      }
    }
    console.log(`${rows.length}件の再送処理を終了`);
    return;
  } else
    throw new Error(
      "Usage: pnpm admin reports list|resolve <id> / quiz inspect|hide|delete <id> / response delete <id> / contacts list|inspect <id> / notifications retry [--remote]",
    );
  console.log(JSON.stringify(execute(query), null, 2));
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
