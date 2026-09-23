import 'dotenv/config';
import { createApp } from './create-app.js';

// Local development only. On Vercel nothing listens: `api/[...slug].ts` boots
// the same app and passes requests straight to it.
const app = await createApp();
await app.listen(process.env.PORT ?? 3000);
