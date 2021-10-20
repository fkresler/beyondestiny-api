import Koa from 'koa';
import Router from '@koa/router';
import { getDestinyManifest } from 'bungie-api-ts/destiny2';
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

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(config.port);
