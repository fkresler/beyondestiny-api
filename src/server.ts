import Koa from 'koa';
import Router from '@koa/router';
import { config } from './config';

import { WeaponManager } from './weaponApi';

const app = new Koa();
const router = new Router();

const weaponManager = new WeaponManager();

router.get('/', (ctx) => {
  ctx.status = 200;
  ctx.body = { success: true };
});

router.get('/weapons', async (ctx) => {
  try {
    const data = await weaponManager.getWeaponDefinitions();
    ctx.status = 200;
    ctx.body = {
      success: true,
      data,
    };
  } catch (e) {
    ctx.status = 503;
    ctx.body = {
      success: false,
      data: e,
    };
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(config.port, 'localhost', () => 'Server started listening!');
