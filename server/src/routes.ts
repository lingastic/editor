const Router = require('@koa/router');
const fs = require('fs');
const path = require('path');
const Db = require('./db');
// const koaBody = require('koa-body')({ multipart: true });
const multer = require('@koa/multer');
const router = new Router();
const Conf = require('./config');
import { LLM } from './LLM';

const conf = new Conf();
const log = Conf.logger;
const baseDir = 'uploads';

const env = process.env;
const db = new Db();
const gpt = new LLM();

/**
 * Get the full schema information from the db about tables, columns, keys, etc
 * See ../db/metadata.sql
 */

router.post('/', async (ctx, next) => {
  const query = 'select * from cdbfly_get_schema()';
  await exec(query, ctx, next);
});

/**
 * Call a postgres function
 */

router.post('/function/:name', async (ctx, next) => {
  const params = Object.values(ctx.request.body);
  // Create the placeholders in the function so we can call something like foo($1, $2, $3)
  // when there are 3 args. Note that these are 1 based
  let placeHolders = '';
  for (let ii = 1; ii <= params.length; ii++) {
    if (ii > 1) {
      placeHolders += ',';
    }
    placeHolders += '$' + ii;
  }
  const query = `select * from ${ctx.params.name}(${placeHolders})`;
  await exec(query, ctx, next, params);
});

router.get('/sql/:query', async (ctx, next) => {
  await sql(ctx, next);
});

// Tentative to serve files from disk.
router.get('/file/:name', async (ctx, next) => {
  const statement = `select mimetype, fsid from  ${conf.fileTable} where name = $1`;
  log.debug(statement, ctx.params.name);
  await exec(statement, ctx, next, [ctx.params.name]);
  if (ctx.status === 200) {
    const result = ctx.body;
    const row = result[0];
    ctx.body = fs.readFileSync(baseDir + path.sep + row['fsid']);
    ctx.type = row['mimetype'];
  }
});

const upload = multer({ dest: baseDir });

router.post('/file', upload.single('file'), async (ctx, next) => {
  const file = ctx.file;
  const statement = `insert into ${conf.fileTable}(name, fsid, mimetype) values ($1, $2, $3)`;
  const params = [file.originalname, file.filename, file.mimetype];
  await exec(statement, ctx, next, params);
  if (ctx.status === 200) {
    ctx.body = '';
  }
});

router.post('/sql', async (ctx, next) => {
  await sql(ctx, next);
});

async function sql(ctx, next) {
  let query = '';
  let params = null;
  if (ctx.request.method === 'POST') {
    query = ctx.request.body.query;
    params = ctx.request.body.values;
  } else {
    //get
    query = ctx.params.query;
  }
  await exec(query, ctx, next, params);
}

async function exec(query: string, ctx, next, params?) {
  let token = '';
  // Check for JWT tokent
  // https://en.wikipedia.org/wiki/JSON_Web_Token#Structure
  const header = ctx.request.header;
  if (header && header.authorization) {
    //  should look like this
    //  Bearer xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    const parts = header.authorization.split(' ');
    if (parts.length === 2) {
      token = parts[1];
    }
  }

  try {
    // Build a prepared statement
    const rand = '' + Math.random() * 10000000;
    const preparedQuery = {
      name: rand, // Generate a unique name
      text: query,
    };
    // Run the query
    let rows = await db.runAuthQuery(preparedQuery, token, params);
    // and send the results
    ctx['body'] = rows;
    ctx.status = 200;
    next();
  } catch (err) {
    // Report the error
    ctx.status = err.statusCode || err.status || 500;
    ctx.body = {
      message: err.message,
    };
  }
}

router.get('/llm', async (ctx, next) => {
  await llm(ctx, next);
});

router.post('/llm', async (ctx, next) => {
  await llm(ctx, next);
});

/**
 * LLM Large Language Model
 * Call the OpenAI GPT-3 API
 * to translate the English query into SQL
 * @param ctx - the context
 * @param next - the next function
 */

async function llm(ctx, next) {
  let query = '';
  if (ctx.request.method === 'POST') {
    query = ctx.request.body.query;
  } else {
    //get
    query = ctx.params.query;
    query = ctx.request.query.query;
  }
  console.log('query', query);
  try {
    const gptResult = await gpt.fetch(query);
    console.log(gptResult.choices[0].message['content']);
    const tokens = gptResult.usage.total_tokens;
    const response = gptResult.choices[0].message['content'];
    ctx.body = {
      response: response,
      tokens: tokens,
    };
    // Got the SQL, now run it
    //await exec(result, ctx, next);
  } catch (err) {
    // Report the error
    ctx.status = err.statusCode || err.status || 500;
    ctx.body = {
      message: err.message,
    };
  }
}

export const routes = router.routes();
