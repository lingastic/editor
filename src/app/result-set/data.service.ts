import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { NGXLogger, NgxLoggerLevel } from 'ngx-logger';
import { GlobService } from '../glob.service';
import * as queryBuilder from 'sql-bricks-postgres';
import { MiscService } from '../utils/misc.service';

/**
 * @title Data services, db operations for relations
 * Performs the CRUD operations on the DB using the REST API:
 */

@Injectable({
  providedIn: 'root',
})
export class DataService {
  // The jwt token header. We could use something like @auth0/angular-jwt to inject them, but this is
  // clearer
  headers;
  glob;

  baseQuery: string; // Full query to fetch data

  constructor(
    private http: HttpClient,
    private logger: NGXLogger,
    private miscService: MiscService,
    private globService: GlobService
  ) {
    this.glob = globService;
    this.baseQuery = `${this.glob.api.url}`;
  }

  delete(table, row, refresh) {
    const rowId = row[table.primaryKey];
    const sql = queryBuilder
      .delete(`${table.schema}.${table.name}`)
      .where({ [table.primaryKey]: rowId })
      .toString();
    this.logger.debug(sql);
    this.doSql(sql, refresh);
  }

  create(table, row, refresh) {
    const sql = queryBuilder.insert(table, row).toString();
    this.logger.debug(table, sql);
    this.doSql(sql, refresh);
  }

  updateItem(table, row, oldRow, refresh) {
    const rowId = oldRow[table.primaryKey];

    /*
     * Ugly workaround. Databricks relies on lodash. Lodash
     * doesn't handle things well if we have a field named
     * 'length'. So we rename the field to a semi-random string
     * and revert it after the query string is generated.
     * TODO: Change databricks to use lodash?
     */
    const LENGTH_FIELD = 'cdbflyLengthf15872055034';
    let hasLength = false;
    if (row['length']) {
      hasLength = true;
      row[LENGTH_FIELD] = row['length'];
      delete row['length'];
    }

    // if there's no schema for the table we just prepend with ''
    const schema = table.schema ? `${table.schema}.` : '';
    let sql = queryBuilder
      .update(`${schema}${table.name}`, row)
      .where({ [table.primaryKey]: rowId })
      .toString();
    if (hasLength) {
      // Second part of the above hack
      sql = sql.replace(`"${LENGTH_FIELD}"`, 'length');
    }
    this.logger.debug(sql);
    this.doSql(sql, refresh);
  }

  doSqlSync(sql, values?) {
    return new Promise(async resolve => {
      this.doSql(sql, resolve, values);
    });
  }

  doSql(sql, refresh, values?) {
    const url = `${this.glob.api.url}/sql`;
    this.http
      .post(url, {
        query: sql,
        values: values,
      })
      .subscribe(
        data => {
          refresh(data); // refresh the table
        },
        (error: HttpErrorResponse) => {
          this.miscService.handleHttpError(error);
        }
      );
  }

  /*
   * Used for paging.
   * Adds a clause to the query to count the number of rows without the limit.
   * See https://stackoverflow.com/questions/156114/best-way-to-get-result-count-before-limit-was-applied/8242764#8242764
   * So we get both the result set and the count at the same time. It does add an extra column with
   * the count which we remove.
   */
  doSqlWithCount(sql) {
    // so we don't need to run the same query twice.
    return new Promise(async resolve => {
      // Add the counting section to the query. Check out the above URL.
      const query = `SELECT count(*) OVER() AS full_count, ${sql}`;
      const url = `${this.glob.api.url}/sql`;
      this.http
        .post(url, {
          query: query,
        })
        .subscribe(
          data => {
            if (!data[0]) {
              // no rows
              resolve({ data: [], count: 0 });
              return;
            }
            const full_count = data[0].full_count;
            // And now remove the column with the count
            for (const ii in data) {
              const row = data[ii];
              delete row['full_count'];
            }
            resolve({ data: data, count: full_count });
          },
          (error: HttpErrorResponse) => {
            this.miscService.handleHttpError(error);
          }
        );
    });
  }

  async sendFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const headers = new HttpHeaders({
      'Content-Type': 'multipart/form-data',
    });
    const options = { headers: headers };
    const url = `${this.glob.api.url}/file`;
    return new Promise(async (resolve, err) => {
      this.http.post(url, formData, options).subscribe(
        data => {
          resolve(data);
        },
        (error: HttpErrorResponse) => {
          this.miscService.handleHttpError(error);
          err(error);
        }
      );
    });
  }

  /**
   * Send a request to the server. This is used for a generic request to the server.
   * @param path The path to the endpoint
   * @param text The text to send to the server
   * @returns A promise that resolves to the response from the server
   * TODO: Generalize the params. Right now takes only a signe one
   */
  async request(path: string, text: string) {
    const url = `${this.glob.api.url}/${path}`;
    return new Promise(async (resolve, err) => {
      this.http.post(url, { query: text }).subscribe(
        data => {
          resolve(data);
        },
        (error: HttpErrorResponse) => {
          this.miscService.handleHttpError(error);
          err(error);
        }
      );
    });
  }

  setHeaders(headers) {
    // Create the header object
    this.headers = { headers: headers };
  }
}
