import Koa from 'koa';
import Router from '@koa/router';
import { config } from './config';

const app = new Koa();
const router = new Router();

router.get('/', (ctx) => {
  ctx.status = 200;
  ctx.body = { success: true };
});

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(config.port);
