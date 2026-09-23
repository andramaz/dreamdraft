import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Migrations need a direct connection — a pooler cannot run DDL — while
    // the app itself goes through the pooled one, because it runs as a Vercel
    // function and a fresh connection per cold start exhausts a small
    // instance. With only one url configured, both use it.
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
});
