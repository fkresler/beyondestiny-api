import * as fs from 'fs';
import Koa from 'koa';
import Router from '@koa/router';
import { getDestinyManifest, getDestinyManifestSlice } from 'bungie-api-ts/destiny2';
import { config } from './config';
import { HttpClientGenerator } from './client';

const app = new Koa();
const router = new Router();
const clientGenerator = new HttpClientGenerator();

router.get('/', (ctx) => {
  ctx.status = 200;
  ctx.body = { success: true };
});

router.get('/manifest', async (ctx) => {
  try {
    const result = await getDestinyManifest(clientGenerator.getClient());
    ctx.status = 200;
    ctx.body = result.Response;
  } catch (e) {
    ctx.status = 500;
    ctx.body = e;
  }
});

router.get('/database', async (ctx) => {
  try {
    const httpClient = clientGenerator.getClient();
    const manifestResponse = await getDestinyManifest(httpClient);
    const result = await getDestinyManifestSlice(httpClient, {
      destinyManifest: manifestResponse.Response,
      language: 'en',
      tableNames: [
        'DestinyInventoryItemDefinition',
        'DestinyCollectibleDefinition',
        'DestinyItemCategoryDefinition',
        'DestinyInventoryBucketDefinition',
      ],
    });
    fs.writeFileSync('inventory.json', JSON.stringify(result.DestinyInventoryItemDefinition));
    fs.writeFileSync('collectibles.json', JSON.stringify(result.DestinyCollectibleDefinition));
    fs.writeFileSync('categories.json', JSON.stringify(result.DestinyItemCategoryDefinition));
    fs.writeFileSync('buckets.json', JSON.stringify(result.DestinyInventoryBucketDefinition));
    ctx.status = 200;
    ctx.body = 'uwu';
  } catch (e) {
    ctx.status = 500;
    ctx.body = e;
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(config.port);
