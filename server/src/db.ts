import { Pool, Client, types } from 'pg';
const fs = require('fs');
const os = require('os');
const mime = require('mime');
const Conf = require('./config');
const conf = new Conf();
const log = Conf.logger;

// See https://github.com/brianc/node-pg-types/issues/50#issuecomment-492144917
// So dates are not converted into timestamps
const TYPE_DATESTAMP = 1082;
types.setTypeParser(TYPE_DATESTAMP, (date) => date);

// Load the db config
// It has role name and password for each tole
const jsonConfig = fs.readFileSync(os.homedir() + '/.cdbfly-lingastic.json');
const dbConfig = JSON.parse(jsonConfig);

class Db {
  static pools;

  constructor() {
    if (!Db.pools) {
      Db.pools = new Map();
      this.initiateRoles();
    }
  }

  /**
   * Initiate the roles that are supported by the app based on the config roles
   */
  initiateRoles() {
    /*
     * Go over the list of roles from the config and create a pool for each role
     */
    for (let role in dbConfig.roles) {
      const userConfig = {
        ssl: dbConfig.ssl,
        host: dbConfig.host,
        database: dbConfig.database,
        user: role,
        password: dbConfig.roles[role],
      };
      const pool = new Pool(userConfig);
      Db.pools.set(role, pool);
      this.checkConnection(role);
      if (dbConfig.host.endsWith('neon.tech')) {
        // neon times out after 5 minutes of inactivity. So we need to keep the connection alive or the app won't be able to connect to the db
        if (role === 'authenticator') {
          // Keep-alive queries
          setInterval(
            async () => {
              try {
                await pool.query('SELECT 1');
                log.debug(`Keep-alive for ${role}`);
              } catch (error) {
                log.error(`Keep-alive query failed for ${role}:`, error);
              }
            },
            4 * 60 * 1000
          ); // 4 minutes
        }
      }
    }
  }

  /**
   * Check the connection for the specific role
   */
  async checkConnection(role: string) {
    const rows = await this.runQuery('select current_user', role);
    log.info('role:' + rows[0].current_user);
  }

  /*
   * Authenticate a user and then run a query
   */
  async runAuthQuery(query: string, token: string, params?) {
    // * First let's get the role for this user based on their token
    let role = 'anon'; // by default the client is anonymous
    if (token === '') {
      // No token, we're just anon/public
    } else {
      // use get_role to authenticate the user and get the role they belong to
      const authQuery = `select * from cdbfly.get_role('${token}')`;
      const rows = await this.runQuery(authQuery, 'authenticator');
      role = rows[0].get_role;
    }
    // And now let's run the actual query using the role
    const rows = await this.runQuery(query, role, params);
    return rows;
  }

  /**
   * Run a query in the appropriate connection pool for their role
   */
  async runQuery(query: string, role: string, params?) {
    log.debug({ role, query });
    if (params) {
      log.debug('with params:', params);
    }
    const pool = Db.pools.get(role);
    if (!pool) {
      const err = `No pool for ${role}. won't run query`;
      console.error(err);
      throw err;
      return;
    }
    const client = await pool.connect();
    try {
      const result = await client.query(query, params);
      log.debug(result.rows);
      return result.rows;
    } catch (err) {
      console.error(query);
      console.error(err);
      throw err; // propagate the error
    } finally {
      // Make sure to release the client before any error handling,
      // just in case the error handling itself throws an error.
      client.release(); //TODO check that we get here on error
    }
  }

  async listenDbEvents(eventName: string, role: string, cb) {
    const pool = Db.pools.get(role);
    const client = await pool.connect();
    log.debug('LISTEN:' + eventName);
    client.on('notification', function (msg) {
      log.debug('NOTIFY:' + eventName);
      cb(msg);
    });
    const query = client.query(`LISTEN ${eventName}`);
    // do not do client.release() since we want to keep listening;
    return query;
  }

  async insertFile(path: string, name: string, mimeType: string) {
    // load the file content as hex data
    let data = '\\x' + fs.readFileSync(path, 'hex');
    const statement = `insert into ${conf.fileTable}(name, content, mimetype) values ($1, $2, $3)`;
    await this.runQuery(statement, 'admin', [name, data, mimeType]);
  }
}

async function test() {
  const db = new Db();
  const rows = await db.runQuery('select count(*) from film limit 3', 'anon');
  log.debug('rows', rows);
  // const path = '/home/dror/tmp/dist/app.module.js';
  const path =
    '/home/dror/tmp/nocodb/packages/nc-gui/assets/img/signup-google.png';
  const fileName = 'signup.png';
  const mimeType = mime.getType(path);
  db.insertFile(path, fileName, mimeType);
}

// test();

module.exports = Db;
