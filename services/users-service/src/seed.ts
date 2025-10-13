import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcryptjs';

async function run() {
  console.log('[users-service] Seed starting...');
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'users-postgres',
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || process.env.DB_DATABASE || 'usersdb',
    entities: [User],
    synchronize: true,
  });
  await ds.initialize();
  const repo = ds.getRepository(User);

  const existingCount = await repo.count();
  if (existingCount) {
    console.log(`[users-service] Seed skipped: users table has ${existingCount} rows`);
    await ds.destroy();
    return;
  }

  const users = [
    {
      username: 'ntn2k4',
      passwordHash: await bcrypt.hash('123456', 10),
      email: 'nguyenthanhnhantg2004@gmail.com',
      fullName: 'Nhan Nguyen',
      phoneNumber: '+84 112345678',
      availableBalance: '5000000000.00',
    },
    {
      username: 'nhandang02',
      passwordHash: await bcrypt.hash('123456', 10),
      email: 'thanhnhandang.it@gmail.com',
      fullName: 'Dang Thanh Nhan',
      phoneNumber: '+84 112345679',
      availableBalance: '2000000000.00',
    },
    {
      username: 'nhandang1502',
      passwordHash: await bcrypt.hash('123456', 10),
      email: '0982717527dtn@gmail.com',
      fullName: 'Dang Thanh Nhan',
      phoneNumber: '+84 112345677',
      availableBalance: '4000000000.00',
    },
  ];
  await repo.save(users.map((u) => repo.create(u)));
  console.log('[users-service] Seeded demo users (3 rows)');
  await ds.destroy();
}

run().catch((e) => {
  console.error('[users-service] Seed failed:', e);
  process.exit(1);
});


