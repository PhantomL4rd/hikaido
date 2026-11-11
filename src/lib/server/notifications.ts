import { and, eq, isNull, lt, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { outbox } from "./schema";
export function escapeSlack(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("@", "＠");
}
export async function retryNotifications(config: Env) {
  if (!config.SLACK_WEBHOOK_URL) return;
  const db = drizzle(config.DB);
  const now = Date.now();
  const rows = await db
    .select()
    .from(outbox)
    .where(
      and(
        or(eq(outbox.status, "pending"), eq(outbox.status, "sending")),
        or(isNull(outbox.leaseUntil), lt(outbox.leaseUntil, now)),
      ),
    )
    .limit(20);
  for (const row of rows) {
    const lease = crypto.randomUUID();
    const claimed = await config.DB.prepare(
      "UPDATE notification_outbox SET status='sending',attempts=attempts+1,lease_until=?,last_error=? WHERE id=? AND (lease_until IS NULL OR lease_until < ?) AND status != 'delivered' RETURNING id",
    )
      .bind(now + 60000, lease, row.id, now)
      .first();
    if (!claimed) continue;
    try {
      const r = await fetch(config.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: escapeSlack(row.payload),
          mrkdwn: false,
          link_names: 0,
          unfurl_links: false,
          unfurl_media: false,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error(`Slack HTTP ${r.status}`);
      await db
        .update(outbox)
        .set({
          status: "delivered",
          deliveredAt: Date.now(),
          leaseUntil: null,
          lastError: null,
        })
        .where(and(eq(outbox.id, row.id), eq(outbox.lastError, lease)));
    } catch {
      await db
        .update(outbox)
        .set({
          status: "pending",
          leaseUntil: Date.now() + 60000,
          lastError: "Slack delivery failed",
        })
        .where(and(eq(outbox.id, row.id), eq(outbox.lastError, lease)));
    }
  }
}
