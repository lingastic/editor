const chokidar = require('chokidar');
const { Pool, Client } = require('pg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createLogger, format, transports } = require('winston');

/*
 * Sync cdbfly pages between the database and the file system
 * so devs can use their favorite editors and other tools on the file system
 * while the database still stays the center for all data.
 */

// load in the config file
const jsonConfig = fs.readFileSync(os.homedir() + '/.cdbflysync.json');
const conf = JSON.parse(jsonConfig);

const pageTable = 'cdbfly.page'; // table in the db that sores the pages;

class SyncPages {
  constructor() {
    this.logLevel = 'info';
    this.setLogging();
    this.pool = new Pool(conf.dbConfig);
    this.dumpPages();
    process.chdir(conf.rootDir);

    // watch the files for changes
    chokidar
      .watch('.')
      // Watching the directory for file changes
      .on('all', async (event, path) => {
        switch (event) {
          case 'change':
            await this.queueOperation(path, 'update');
            break;
          case 'add':
            await this.queueOperation(path, 'insert');
            break;
          case 'unlink':
            await this.queueOperation(path, 'delete');
            break;
          case 'addDir':
            await this.queueOperation(path, 'insert', true);
            break;
          case 'unlinkDir':
            await this.queueOperation(path, 'delete', true);
            break;
            // do nothing on directories
            break;
          default:
            this.logger.info(`ignoring ${event} operation on ${path}`);
            // Currently we only track file changes. Adding and deleting files
            // is done in the app
            break;
        }
      })
      .on('ready', () =>
        this.logger.info(
          '========= Initial scan complete. Ready for changes ========'
        )
      );
  }

  /*
   *
   * Dump the pages from the db into the file system.
   * We only dump pages that don't already exist in the file system
   * for ease of use in the browser, pages use delimiter, default '.'
   * these need to be translated into a directory path in the os
   */
  async dumpPages() {
    // add '\\' before the dbPathDelimiter to escape '.' so it doesn't
    // match every letter
    const query = `select * from ${pageTable}`;
    const queryResult = await this.runSQL(query);
    const result = queryResult.rows;
    for (let ii = 0; ii < result.length; ii++) {
      const page = result[ii];
      let fsPath = page.name;
      fsPath = fsPath.slice(1);
      if (fsPath === '') {
        continue; // ignore the root dir
      }
      if (page.language && page.language !== 'DIR') {
        fsPath += conf.fileExtension[page.language];
      }
      if (fs.existsSync(fsPath)) {
        this.logger.debug(
          `Skipping fetching ${fsPath} from db, already exists on disk`
        );
        continue; // If the file already exists, we don't create it
      }
      this.logger.info(`Fetching ${page.name} from db, into ${fsPath}`);
      if (page.language === 'DIR') {
        this.logger.info(`create dir ${fsPath}`);
        mkdirRecursive(fsPath);
        continue;
      }
      const dir = path.dirname(fsPath);
      const file = path.basename(fsPath);
      if (!fs.existsSync(dir)) {
        this.logger.info(`create dir ${fsPath}`);
        mkdirRecursive(dir);
      }
      fs.writeFileSync(fsPath, page.text);
    }
  }

  /*
   * Run a database statement and handle errors
   * @param [string] statement: the statement to run
   * @param [array] params: an array of params to pass to the statement.
   *   The statement uses placeholders. See the use of $1 in handlePage()
   */
  async runSQL(statement, params) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(statement, params);
      client.release();
      return result;
    } catch (err) {
      console.error(statement);
      console.error(err);
      client.release();
      // propagate the error. This will cause the process to stop. It's less than ideal, but
      // we don't have an easy way to let the user know that there's an issue
      throw err;
    }
  }

  /*
   * chokidar runs in an async fashion generating ops as it scans the dir.
   * This introduces a race condition when inserting a file into the db can happen
   * before the dir it depends on is created.
   * Here we serialze the calls to avoid this issue.
   * Based on https://stackoverflow.com/a/53540586/460278
   */
  queueOperation = (() => {
    let pending = Promise.resolve();

    const run = async (filePath, operationType, isDir) => {
      try {
        await pending;
      } finally {
        return await this.handlePage(filePath, operationType, isDir);
      }
    };

    // update pending promise so that next task could await for it
    return (filePath, operationType, isDir) =>
      (pending = run(filePath, operationType, isDir));
  })();

  /*
   * On a page change in the file system, update the page in the db
   * @param [string] filePath: the full path including the file
   * @param [string] operationType: which CRUD operation
   * @param [isDir] boolean: is it a directory?
   *
   */
  async handlePage(filePath, operationType, isDir = false) {
    const file = path.parse(filePath);
    // build the file path without the extension
    let fileNoExt = file.name; // when there's no path it's simply the file name
    if (file.dir !== '') {
      fileNoExt = file.dir + path.sep + file.name; //otherwise include the directory
    }
    if (fileNoExt === '.') {
      fileNoExt = ''; // Root dir special case
    }
    const pageName = '/' + fileNoExt;
    // get the file type from the extension
    let pageContent = '';
    let statement = '';
    let params = [];
    switch (operationType) {
      case 'update':
        pageContent = fs.readFileSync(filePath, { encoding: 'utf8' });
        statement = `update ${pageTable} set text = $1 where name = '${pageName}'`;
        params = [pageContent];
        break;
      case 'insert':
        const revFileExtension = {};
        for (var key in conf.fileExtension) {
          revFileExtension[conf.fileExtension[key]] = key;
        }
        let language = revFileExtension[file.ext];
        if (language === undefined) {
          language = '';
        }
        if (isDir) {
          language = 'DIR';
        } else {
          pageContent = fs.readFileSync(filePath, { encoding: 'utf8' });
        }
        statement = `insert into ${pageTable} select $1, $2, $3, $4 where not exists ( select name from ${pageTable} where name = $1)`;
        params = [pageName, conf.defaultUser, pageContent, language];
        break;
      case 'delete':
        statement = `delete from ${pageTable} where name = '${pageName}' and name is not null`;
        break;
      default:
        break;
    }
    const result = await this.runSQL(statement, params);
    if (result.rowCount > 0) {
      this.logger.info(
        `${operationType} path: '${fileNoExt}' db page: '${pageName}'`
      );
    } else {
      this.logger.info(
        `${operationType} path: ${fileNoExt}, into db page ${pageName} did not happen, probably because it already exists in the db`
      );
    }
  }

  setLogging() {
    /**
     * Logging using winston. Default logging method "info"
     *
     * @method logger
     */
    let date = new Date().toISOString();
    const logFormat = format.printf(function (info) {
      return `${date}-${info.level}: ${JSON.stringify(info.message, null, 2)}`;
    });
    this.logger = createLogger({
      transports: [
        new transports.Console({
          level: this.logLevel,
          format: format.combine(format.colorize(), logFormat),
        }),
      ],
    });
    this.logger.info(
      `========= Starting SyncPages log level: '${this.logLevel}' dir: '${conf.rootDir}' =========`
    );
  }
}

/*
 * pollyfill to make a directory recursively.
 * Should be equivalent to fs.mkdirSync(dir, {recursive: true});
 */

function mkdirRecursive(dir) {
  const parent = path.dirname(dir);
  if (parent !== '.') {
    mkdirRecursive(parent);
  }
  if (fs.existsSync(dir)) {
    return;
  }
  fs.mkdirSync(dir);
}

async function run() {
  const syncPages = new SyncPages();
}

run();
module.exports = SyncPages;
