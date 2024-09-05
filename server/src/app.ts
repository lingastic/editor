import * as Koa from 'koa';
const app: Koa = new Koa();
import * as json from 'koa-json';
import * as bodyparser from 'koa-bodyparser';
import * as logger from 'koa-logger';
import * as cors from '@koa/cors';
import { routes } from './routes';
const Conf = require('./config');
const conf = new Conf();
const log = Conf.logger;

// middlewares
app.use(
  bodyparser({
    enableTypes: ['json', 'form', 'text'],
  })
);
app.use(json());
app.use(logger());

// logger
app.use(async (ctx, next) => {
  try {
    const start = <any>new Date();
    await next();
    const ms = <any>new Date() - start;
    log.info(`${ctx.method} ${ctx.url} - ${ms}ms`);
  } catch (err) {
    log.error(err);
    ctx.status = err.status || 500;
    ctx.body = {
      message: err.message,
      position: err.position,
      postgresCode: err.code,
    };
    ctx.app.emit('error', err, ctx);
  }
});

// routes
app.use(routes);

// error-handling
app.on('error', (err, ctx) => {
  log.error('=============');
  log.error(err.message);
  log.error(err.code);
  log.error('=============');
});

module.exports = app;
