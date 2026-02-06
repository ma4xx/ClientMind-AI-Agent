import { and, count, desc, eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { apikey } from '@/config/db/schema';

import { getUserByUserIds, User } from './user';

export type Apikey = typeof apikey.$inferSelect & {
  user?: User;
};
export type NewApikey = typeof apikey.$inferInsert;
export type UpdateApikey = Partial<typeof apikey.$inferInsert>;

export enum ApikeyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DELETED = 'deleted',
}

export async function createApikey(data: NewApikey) {
  const [result] = await db().insert(apikey).values(data).returning();
  return result;
}

export async function updateApikeyById(id: string, data: UpdateApikey) {
  const [result] = await db()
    .update(apikey)
    .set(data)
    .where(eq(apikey.id, id))
    .returning();
  return result;
}

export const updateApikey = updateApikeyById;

export async function deleteApikeyById(id: string) {
  const [result] = await db()
    .update(apikey)
    .set({ status: ApikeyStatus.DELETED, deletedAt: new Date() })
    .where(eq(apikey.id, id))
    .returning();
  return result;
}

export async function findApikeyById(id: string) {
  const [result] = await db().select().from(apikey).where(eq(apikey.id, id));
  return result;
}

export async function findApikeyByKey(key: string) {
  const [result] = await db()
    .select()
    .from(apikey)
    .where(and(eq(apikey.key, key), eq(apikey.status, ApikeyStatus.ACTIVE)));
  return result;
}

export async function getApikeys({
  page = 1,
  limit = 30,
  userId,
  status,
  getUser = false,
}: {
  userId?: string;
  status?: string;
  page?: number;
  limit?: number;
  getUser?: boolean;
} = {}): Promise<Apikey[]> {
  const where = and(
    userId ? eq(apikey.userId, userId) : undefined,
    status ? eq(apikey.status, status) : undefined
  );

  const result = (await db()
    .select()
    .from(apikey)
    .where(where)
    .orderBy(desc(apikey.createdAt))
    .limit(limit)
    .offset((page - 1) * limit)) as Apikey[];

  if (getUser && result.length > 0) {
    const userIds = Array.from(
      new Set(result.map((item) => item.userId))
    ).filter(Boolean) as string[];
    const users = (await getUserByUserIds(userIds)) as User[];
    const userMap = new Map<string, User>(users.map((u) => [u.id, u]));

    return result.map((item) => ({
      ...item,
      user: userMap.get(item.userId),
    })) as Apikey[];
  }

  return result;
}

export async function getApikeysCount({
  userId,
  status,
}: {
  userId?: string;
  status?: string;
} = {}) {
  const where = and(
    userId ? eq(apikey.userId, userId) : undefined,
    status ? eq(apikey.status, status) : undefined
  );

  const result = await db()
    .select({ count: count() })
    .from(apikey)
    .where(where);

  return result[0]?.count || 0;
}
