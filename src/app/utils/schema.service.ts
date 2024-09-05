import { Injectable } from '@angular/core';
import { GlobService, relationType, keyType } from '../glob.service';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { NGXLogger, NgxLoggerLevel } from 'ngx-logger';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AccountService } from '../account/account.service';

@Injectable({
  providedIn: 'root',
})

/**
 * Load the metadata information from the db using a stored procedure that
 * we created.
 * Analyze the schema and set up the structure for the tables, views keys, roles, etc
 */
export class SchemaService {
  relations; // A map of all relations in the db both tables and view
  tabs; // A map of the tables in the db
  tabsWithManyToMany; // A map of the tables in the db
  views; // A map of the views in the db
  keys; // all keys in the schema
  roles; // DB roles used in the app
  currRole; // current role/group of the current user
  currApp; // current app
  isAdmin = false; // is the current user an admin?

  // prettier-ignore
  constructor(
    private glob: GlobService,
    private http: HttpClient,
    private logger: NGXLogger,
    private snackBar: MatSnackBar,
    private accountService: AccountService,
  ) {
    this.relations = new Map();
    this.tabs = new Map();
    this.tabsWithManyToMany = new Map();
    this.views = new Map();
    this.roles = [];
    globLogger = this.logger;

  }

  /**
   * Adapted from // https://stackoverflow.com/questions/21147832/convert-camel-case-to-human-readable-string
   * Given a table/field name convert from camelcase/snakecase to capitalize. Example: 'customer_id' becomes 'Customer Id'
   * @param {str} String - the name we're  prettying
   */

  static prettyWords(str) {
    const words = str.match(/[A-Za-z0-9][a-z0-9]*/g) || [];
    return words.map(this.capitalize).join(' ');
  }

  static capitalize(word) {
    return word.charAt(0).toUpperCase() + word.substring(1);
  }

  /**
   * Fetch the metadata
   * And convert it into easy-to-use structure
   */
  parseSchema() {
    return new Promise<void>(resolve => {
      this.http
        .post(`${this.glob.api['url']}/function/public.cdbfly_get_schema`, {})
        .subscribe(
          data => {
            const relations = data[0].schema.relations;
            this.keys = data[1].schema.keys;
            const stats = data[2].schema.stats;
            this.roles = data[3].schema.roles[0];
            this.currRole = data[5].schema.curr_role[0].role;
            this.isAdmin = this.currRole === 'admin';
            this.logger.debug('relations:', relations);
            this.logger.debug('keys:', this.keys);
            this.logger.debug('stats:', stats);
            this.logger.debug('roles:', this.roles);
            this.logger.debug('curr_role:', this.currRole);
            this.logger.debug('isAdmin:', this.isAdmin);
            this.getApp(data);
            this.logger.debug('currApp:', this.currApp);

            // Iterate over relations separating tables and views
            for (const id in relations) {
              const rel = relations[id];
              // tslint:disable-next-line
              const newRelation = new Relation(rel);
              this.logger.debug('re:', newRelation);
              if (newRelation.schema === 'public') {
                this.relations.set(newRelation.name, newRelation);
              } else {
                this.relations.set(
                  `${newRelation.schema}.${newRelation.name}`,
                  newRelation
                );
              }
              if (rel.table_type === relationType.TABLE) {
                this.tabs.set(rel.table_name, newRelation);
              } else if (rel.table_type === relationType.VIEW) {
                this.views.set(rel.table_name, newRelation);
              } else {
                this.logger.error('Unknown relation type', rel.table_type);
              }
            }

            for (const stat of stats) {
              const tab = this.tabs.get(stat.relname);
              if (tab) {
                tab.number_rows = stat.number_rows;
                this.tabs.set(stat.relname, tab);
              }
            }
            // got the schema Send out the schema info
            this.logger.debug('SchemaService done');
            this.setKeys();
            this.tabsWithManyToMany = new Map(this.tabs);
            this.setManyToMany();
            resolve();
          },
          (error: HttpErrorResponse) => {
            if (error.status === 401 && error.error.message === 'JWT expired') {
              this.accountService.removeUserInfo(); // Remove saved JWT
              alert('Your session has expired');
              location.reload();
            } else {
              this.logger.error(error);
              this.snackBar.open(
                `Error: ${error.name} ${error.error.message}`,
                'Dismiss',
                {}
              );
            }
            resolve();
          }
        );
    });
  }

  /**
   * Get the current app
   * Used to determine what's the home page
   */

  getApp(data: object) {
    const apps = data[6];
    // find the current app
    if (!apps?.schema.apps) {
      return;
    }
    for (const app of apps?.schema.apps) {
      if (app.name === this.glob.api['app']) {
        this.currApp = app;
        break;
      }
    }
  }

  /*
   * Go through the keys and update tables and columns to indicate
   * primary and foreign keys
   */
  setKeys() {
    for (const key of this.keys) {
      const keyTable = key['source_table'];
      const keySchema = key['source_schema'];
      let relation;
      if (keySchema === 'public') {
        relation = this.relations.get(keyTable);
      } else {
        // if it's not in the 'public' schema we use the schema.table combo
        relation = this.relations.get(`${keySchema}.${keyTable}`);
      }
      if (!relation) {
        continue; // We don't have access/permission to this relation
      }
      if (key['constraint_type'] === keyType.PRIMARY) {
        relation.primaryKey = key['source_column'];
      } else {
        // Foreigh key
        const sourceCol = relation['columns'].get(key['source_column']);
        // Set in the origin column the name of the target table and column
        sourceCol.foreignKeyCol = key.target_column_name;
        sourceCol.foreignKeyTab = key.target_table_name;
        sourceCol.foreignKeySchema = key.target_table_schema;
      }
    }
  }

  /*
   * Go through the tables and find the ones that are many to many
   * relations: two foreign keys and optionally a timestamp/date
   * and nothing else
   */
  setManyToMany() {
    for (const tt of this.tabs) {
      const tab = tt[1];
      let foreignKeyNum = 0;
      tab.isManyToMany = true;
      for (const column of tab.columns) {
        const col = column[1];
        if (col.foreignKeyCol && col.foreignKeyCol !== '') {
          foreignKeyNum++;
        } else if (col.colType !== 'Date') {
          tab.isManyToMany = false;
        }
      }
      if (foreignKeyNum !== 2) {
        tab.isManyToMany = false;
      }
      if (tab.isManyToMany) {
        this.tabs.delete(tab.name);
      }
    }
  }

  getRelations() {
    return this.relations;
  }

  getRoles() {
    return this.roles;
  }
}

export enum ColType {
  Array = 'array',
  Boolean = 'boolean',
  Number = 'number',
  bigint = 'Bigint',
  Date = 'date',
  Json = 'json',
  Tsvector = 'tsvector',
  Bytea = 'bytea',
  Object = 'object',
  String = 'string',
  Time = 'time',
  Uuid = 'uuid',
}

let globLogger;
/**
 * @class Col
 * A db column,
 * See https://www.postgresql.org/docs/current/infoschema-columns.html
 */
export class Col {
  name = ''; // of the column
  prettyName = ''; // Pretty name user_id becomes User Id
  required: boolean; // Is it required
  colDefault: ''; // Default value in the db. Can be a function
  position: -1; // Ordinal position of the column within the table (count starts at 1)
  updateable: boolean; // Can this column be updated? Views can have columns that don't update
  colType: ColType; // Javascript/typescript type
  colTypeExtra: string; // extra information about the column type
  foreignKeyCol = '';
  foreignKeyTab = '';

  /**
   * @constructor
   *
   * @param {dbCol} data from the db describing the column
   * TODO: consider using https://github.com/sequelize/sequelize/blob/main/lib/dialects/postgres/data-types.js
   * for more complete data type handling
   */

  constructor(dbCol: object) {
    this.name = dbCol['column_name'];
    this.prettyName = SchemaService.prettyWords(this.name);
    this.required = dbCol['is_nullable'] === 'NO';
    this.colDefault = dbCol['column_default'];
    this.position = dbCol['ordinal_position'];
    this.updateable = dbCol['is_updatable'] === 'YES';
    const dataType = dbCol['data_type'].toLowerCase();

    // Convert from the db format to javascript/typescript and HTML format
    switch (dataType) {
      case 'array': {
        this.colType = ColType.Array;
        break;
      }
      case 'boolean': {
        this.colType = ColType.Boolean;
        break;
      }
      case 'bigint':
      case 'integer':
      case 'smallint': {
        this.colType = ColType.Number;
        this.colTypeExtra = 'int';
        break;
      }
      case 'double':
      case 'float':
      case 'real':
      case 'numeric': {
        this.colType = ColType.Number;
        break;
      }
      case 'date': {
        this.colType = ColType.Date;
        break;
      }
      case 'tsvector': {
        this.colType = ColType.Tsvector;
        break;
      }
      case 'bytea': {
        this.colType = ColType.Bytea;
        break;
      }
      case 'character':
      case 'name':
      case 'text': {
        this.colType = ColType.String;
        break;
      }
      case 'uuid': {
        this.colType = ColType.Uuid;
        break;
      }
      default: {
        this.colType = ColType.String;
        break;
      }
    }

    // json, jsonb, etc
    if (dataType.startsWith('json')) {
      this.colType = ColType.Json;
    }
    if (dataType.startsWith('timestamp')) {
      this.colType = ColType.Date;
    }
    globLogger.debug(this.name, dataType, this.colType);
  }
}

/**
 * @class Relation
 * A db relation, This can be either a database table or view
 * Collect all the data about the table and columns
 */
export class Relation {
  schema = ''; // The database schema, typically 'public'
  name = ''; // Table or view name
  prettyName = ''; // Name we show the user
  columns = new Map(); // Columns in the relation
  required: string[]; // Names of required columns/fields
  primaryKey = ''; // Name of the primary key if any
  relationType: string; // Table or view
  canDelete: boolean; // Current user has permission to delete
  canInsert: boolean; // Current user has permission to insert/create
  canSelect: boolean; // Current user has permission to select/view
  canUpdate: boolean; // Current user has permission to update
  insertable: boolean; // Can anyone insert into this relation. False for certain views
  numberRows: number; // DBs estimate of number of rows in the table

  /**
   * @constructor
   * A db Table or view
   * @param {dbRelation} Object - the db JSON object containing all the info about the table
   */

  constructor(dbRelation: object) {
    this.name = dbRelation['table_name'];
    this.prettyName = SchemaService.prettyWords(this.name);
    this.schema = dbRelation['table_schema'];
    this.canSelect = dbRelation['can_select'];
    this.canUpdate = dbRelation['can_update'];
    this.canInsert = dbRelation['can_insert'];
    this.canDelete = dbRelation['can_delete'];
    this.numberRows = dbRelation['number_rows'];
    this.insertable = dbRelation['is_insertable_into'];
    this.relationType = dbRelation['table_type'];
    globLogger.debug(this.name, '------------');
    for (const dbCol of dbRelation['cols']) {
      const newCol = new Col(dbCol);
      this.columns.set(newCol.name, newCol);
    }
  }
}
