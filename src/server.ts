import Koa from 'koa';
import Router from '@koa/router';
import { getDestinyManifest } from 'bungie-api-ts/destiny2';
import { config } from './config';
import { HttpClientGenerator } from './client';

import { weaponApi } from './weaponApi';

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

router.get('/database', async (ctx) => weaponApi(ctx));

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(config.port, 'localhost', () => 'Server started listening!');
