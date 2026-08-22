import { buildApp } from './src/app';
import fs from 'fs';

async function exportSwagger() {
  const app = await buildApp();
  await app.ready();
  const swaggerJson = app.swagger();
  fs.writeFileSync('postman_collection.json', JSON.stringify(swaggerJson, null, 2));
  console.log('Successfully generated postman_collection.json');
  process.exit(0);
}

exportSwagger().catch(err => {
  console.error(err);
  process.exit(1);
});
