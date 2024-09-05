/**
 *  * Application wide globals
 *   */

import { Injectable } from '@angular/core';


export enum relationType {
  TABLE = 'BASE TABLE',
  VIEW = 'VIEW',
}

export enum keyType {
  PRIMARY = 'PRIMARY KEY',
  FOREIGN = 'FOREIGN KEY',
}

export enum tableName {
  PAGE = 'cdbfly.page',
  TEMPLATE = 'cdbfly.template',
  FILE = 'cdbfly.file',
}

@Injectable({
  providedIn: 'root',
})
export class GlobService {
  // Information about the API sqlql server
  devApi: object = {
    servers: [
      {
        regex: '^cdbfly.org.*', // this is the production server
        url: `https://dev.libris.app`,
      },
        {
        regex: '^c1.lingastic.org', // this is the lingastic local server
        url: `https://c2.lingastic.org`,
      },
      {
        regex: '.*netlify.app.*', // these are our netlify branches
        url: `https://api2.libris.app`,
        app: 'matal', // and we are using the matal app/schema
      },
      {
        regex: '.*edit.lingastic.org.*', // these are our netlify branches
        url: `https://api2.lingastic.org`,
      },
      {
        regex: 'dror.matal.com.*',
        url: `https://api2.libris.app`,
        app: 'matal', // and we are using the matal app/schema
      },
      {
        regex: '.*', // this is the default -- localhost
        url: `http://${window.location.hostname}:5000`, // The server
      },
    ],
  };

  /*
  prodApi: object = {
    url: `https://dev.libris.app`,
    // url: `https://api.${BASE_SERVER}`,
  };
  */

  api: object = {};

  header: object;

  /**
   * Adapted from // https://stackoverflow.com/questions/21147832/convert-camel-case-to-human-readable-string
   * Given a table/field name convert from camelcase/snakecase to capitalize
   * Example customer_id -> Customer Id
   */

  prettyWords(str: string) {
    if (!str) {
      return;
    }
    const words = str.match(/[A-Za-z0-9][a-z0-9]*/g) || [];
    return words.map(this.capitalize).join(' ');
  }

  capitalize(word: string) {
    return word.charAt(0).toUpperCase() + word.substring(1);
  }

  sleep(ms: number) {
    return new Promise(resolve => {
      return setTimeout(resolve, ms);
    });
  }
}
