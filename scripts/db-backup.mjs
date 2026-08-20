import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../generated/prisma/index.js';
import fs from 'fs';
import path from 'path';

// Set up pg pool
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting Database Backup...');
  
  // List of all models in schema.prisma
  const models = [
    { name: 'user', map: 'users' },
    { name: 'account', map: 'accounts' },
    { name: 'session', map: 'sessions' },
    { name: 'verificationToken', map: 'verification_tokens' },
    { name: 'publicProfile', map: 'public_profiles' },
    { name: 'cohort', map: 'cohorts' },
    { name: 'cohortSource', map: 'cohort_sources' },
    { name: 'season', map: 'seasons' },
    { name: 'lesson', map: 'lessons' },
    { name: 'community', map: 'communities' },
    { name: 'channel', map: 'channels' },
    { name: 'message', map: 'messages' },
    { name: 'studyRoom', map: 'study_rooms' },
    { name: 'roomParticipant', map: 'room_participants' },
    { name: 'cohortMember', map: 'cohort_members' },
    { name: 'lessonProgress', map: 'lesson_progress' },
  ];

  const backupData = {};

  for (const model of models) {
    try {
      console.log(`Fetching data for model: ${model.name}...`);
      const data = await prisma[model.name].findMany();
      backupData[model.name] = data;
      console.log(`Fetched ${data.length} records for ${model.name}.`);
    } catch (err) {
      console.error(`Failed to fetch data for ${model.name}:`, err.message);
    }
  }

  const backupPath = path.resolve('prisma/db_backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log(`Database backup saved successfully to: ${backupPath}`);
}

main()
  .catch((err) => console.error('Backup failed:', err))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
