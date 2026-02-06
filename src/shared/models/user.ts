import { headers } from 'next/headers';
import { count, desc, eq, inArray } from 'drizzle-orm';

import { getAuth } from '@/core/auth';
import { db } from '@/core/db';
import { user } from '@/config/db/schema';

import { Permission, Role } from '../services/rbac';

export type User = typeof user.$inferSelect & {
  isAdmin?: boolean;
  roles?: Role[];
  permissions?: Permission[];
};
export type NewUser = typeof user.$inferInsert;
export type UpdateUser = Partial<Omit<NewUser, 'id' | 'createdAt' | 'email'>>;

export async function updateUser(userId: string, updatedUser: UpdateUser) {
  const [result] = await db()
    .update(user)
    .set(updatedUser)
    .where(eq(user.id, userId))
    .returning();

  return result;
}

export async function findUserById(userId: string) {
  const [result] = await db().select().from(user).where(eq(user.id, userId));

  return result;
}

export async function getUsers({
  page = 1,
  limit = 30,
  email,
}: {
  email?: string;
  page?: number;
  limit?: number;
} = {}): Promise<User[]> {
  const result = await db()
    .select()
    .from(user)
    .where(email ? eq(user.email, email) : undefined)
    .orderBy(desc(user.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return result;
}

export async function getUsersCount({ email }: { email?: string }) {
  const result = await db()
    .select({ count: count() })
    .from(user)
    .where(email ? eq(user.email, email) : undefined);
  return result[0]?.count || 0;
}

export async function getUserByUserIds(userIds: string[]) {
  const result = await db()
    .select()
    .from(user)
    .where(inArray(user.id, userIds));

  return result;
}

export async function getUserInfo() {
  const signUser = await getSignUser();

  return signUser;
}

export async function getSignUser() {
  // Development Mock Auth
  if (
    process.env.MOCK_AUTH === 'true' &&
    process.env.NODE_ENV === 'development'
  ) {
    return {
      id: 'mock-user-id',
      name: 'Mock Developer',
      email: 'dev@example.com',
      image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.user;
}

export async function appendUserToResult(result: any) {
  if (!result || !result.length) {
    return result;
  }

  const userIds = result.map((item: any) => item.userId);
  const users = await getUserByUserIds(userIds);
  result = result.map((item: any) => {
    const user = users.find((user: any) => user.id === item.userId);
    return { ...item, user };
  });

  return result;
}
