import "server-only";
import { getDb } from "@/db";
import { auditLog } from "@/db/schema";

export async function audit(
  actorId: number,
  action: string,
  entity: string,
  entityId: number | string | null,
  detail?: Record<string, unknown>,
) {
  await getDb()
    .insert(auditLog)
    .values({ actorId, action, entity, entityId: entityId === null ? null : String(entityId), detail });
}
