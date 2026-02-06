import { db } from '../src/core/db';
import { user } from '../src/config/db/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function main() {
  console.log('Checking for mock user...');
  
  const mockUserId = 'mock-user-id';
  
  const existingUser = await db()
    .select()
    .from(user)
    .where(eq(user.id, mockUserId))
    .limit(1);

  if (existingUser.length > 0) {
    console.log('Mock user already exists.');
    return;
  }

  console.log('Creating mock user...');
  
  await db().insert(user).values({
    id: mockUserId,
    name: 'Mock Developer',
    email: 'dev@example.com',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  });

  console.log('Mock user created successfully!');
  console.log('ID: mock-user-id');
  console.log('Email: dev@example.com');
}

main()
  .catch((e) => {
    console.error('Error creating mock user:', e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
