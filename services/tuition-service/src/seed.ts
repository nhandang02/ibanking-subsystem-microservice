import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Tuition } from './entities/tuition.entity';

async function run() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'tuition-postgres',
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || process.env.DB_DATABASE || 'tuition_db',
    entities: [Tuition],
    synchronize: true,
  });
  await ds.initialize();
  const repo = ds.getRepository(Tuition);

  if (await repo.count()) {
    console.log('[tuition-service] Seed skipped: not empty');
    await ds.destroy();
    return;
  }

  await repo.save([
    repo.create({ studentId: '522H0006', studentName: 'Dang Thanh Nhan', amount: '1500000.00', isActive: true }),
    repo.create({ studentId: '522H0051', studentName: 'Nguyen Thanh Nhan', amount: '2000000.00', isActive: true }),
  ]);
  console.log('[tuition-service] Seeded demo students');
  await ds.destroy();
}

run().catch((e) => {
  console.error('[tuition-service] Seed failed:', e);
  process.exit(1);
});


