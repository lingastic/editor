import { Component, Input, OnChanges, ViewChild, NgZone } from '@angular/core';
import { DataService } from '../result-set/data.service';
import { PageDataService, Tile } from './data.service';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { GlobService, tableName } from '../glob.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { BroadcastChannel } from 'broadcast-channel';
import * as marked from 'marked';
import * as ejs from 'ejs';
import { initVimMode } from 'monaco-vim';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SchemaService, Col, Relation } from '../utils/schema.service';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import * as queryBuilder from 'sql-bricks-postgres';

declare interface Message {
  text: string;
}

const COLS = 12; // Total number of cols
const ROWS = 12; // Total number of rows

/**
 * @title Create or edit a page
 *
 * A cdbfly page has multiple functions
 * Markdown -- we use marked to handle markdown
 * Templating -- we use ejs to handle both javascript logic and the markup
 * SQl -- We let the user create SQL statement and the result is returned to the front-end
 */
@Component({
  selector: 'app-page-edit',
  templateUrl: './edit.html',
  styleUrls: ['./page.css'],
})
export class PageEditComponent {
  @ViewChild('editor', { static: false }) editor;
  @ViewChild('status', { static: false }) status;
  cols = COLS;
  multiplier = 1;
  glob;
  output = ''; // The output of the page
  name = ''; // The name of the page in the table
  role = ''; // The role in the table
  error = null; // Errors in processing
  text = ''; // text in the editor
  isInsert = true; // Are we doing an insert/create or update/edit
  tiles: Tile[] = []; // tiles in the dashboard
  broadcastChannel: BroadcastChannel; // To communicate with other tabs
  newWin = null; // a new window where we display the page
  pageProps = { text: null };
  editorOptions = {
    theme: 'vs-light',
    language: 'javascript',
    tabSize: 2,
    wordWrap: 'on',
    minimap: {
      enabled: false,
    },
  };
  language = '';
  languages = ['markdown', 'javascript'];

  constructor(
    private dataService: DataService,
    private pageDataService: PageDataService,
    private route: ActivatedRoute,
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private globService: GlobService,
    public schemaService: SchemaService,
    private breakpointObserver: BreakpointObserver,
    private zone: NgZone
  ) {
    this.glob = globService;
    /*
     * the route /pageedit/cdbfly/tutorial/links will have the segments
     * ['pageedit','cdbfly', ,tutorial' ,links']
     */

    // '/pageedit' means edit the page '/page' means view it
    this.route.params.subscribe(params => {
      // the segmens of the route are an array of the route parts without the '/'
      const routeSegments = this.route.snapshot.url;
      routeSegments.shift(); // remove 'pageedit' elemnt
      if (routeSegments) {
        this.name = '/' + routeSegments.join('/'); // the name of the page in the db
        this.isInsert = this.route.snapshot.queryParams.insert;
        this.loadText();
      }
      this.broadcastChannel = new BroadcastChannel(`changed-${this.name}`);
    });
    this.makeResponsive();
  }

  /*
   * when we're doing the update or view load the text from
   * the db. Otherwise, we're creating a new page.
   */
  async loadText() {
    const query = queryBuilder
      .select('*')
      .from(tableName.PAGE)
      .where('name', this.name);
    const result = await this.dataService.doSqlSync(query.toString());
    if (result[0]) {
      this.text = result[0].text;
      this.role = result[0].role;
      this.name = result[0].name;
      this.language = result[0].language;
      this.setLanguage();
    }
  }

  /**
   * Called by Ace when the text is changed.
   * @param {text} String -- the new value of the text
   */
  changed(text) {
    this.text = text;
  }

  /**
   * Insert -- create a new row in the db
   */
  insert() {
    const row = {
      name: this.name,
      role: this.role,
      text: this.text,
      language: this.language,
    };
    this.dataService.create(tableName.PAGE, row, () => {
      this.snackBar.open(`Page  "${this.name}" Created`, 'Dismiss', {
        duration: 4000,
      });
      this.isInsert = false; // Once we've created it, we should update
    });
  }

  /**
   * Insert -- Update a new row in the db
   */
  update() {
    const row = {
      name: this.name,
      role: this.role,
      text: this.text,
      language: this.language,
    };
    const tableInfo = { name: tableName.PAGE, primaryKey: 'name' };
    this.dataService.updateItem(tableInfo, row, row, () => {
      this.snackBar.open(`Page  "${this.name}" saved`, 'Dismiss', {
        duration: 4000,
      });
    });
  }

  /**
   * The UI has a single operation, save, for both insert and update
   * We chose the appropriate action
   */
  save() {
    if (this.isInsert) {
      this.insert();
    } else {
      this.update();
    }
  }

  async run() {
    // If we just edited the page send an update to other tabs
    // that are open to this page
    this.broadcastChannel.postMessage({
      text: this.text,
    });
  }

  /*
   * Make the tiles responsive. There are probbaly cleaner ways.
   */

  makeResponsive() {
    // adapted from https://github.com/angular/flex-layout/wiki/Responsive-API
    const outerWidth = window.outerWidth;
    let breakPoint = 'XS'; // > 600
    if (innerWidth >= 1920) {
      breakPoint = 'XL';
    } else if (innerWidth < 1920 && innerWidth >= 1280) {
      breakPoint = 'LG';
    } else if (innerWidth < 1280 && innerWidth >= 960) {
      breakPoint = 'MD';
    } else if (innerWidth < 960 && innerWidth >= 600) {
      breakPoint = 'SM';
    }

    /*
     * When the width is small, we make the multiplier bigger  which ends up
     * making the card wider and makes the cards // got under each other rather
     * than side by side
     */
    switch (breakPoint) {
      case 'XS':
      case 'SM':
        this.multiplier = 2;
        break;
      default:
        this.multiplier = 1;
        break;
    }
  }

  /**
   * Open the resulting page in a new tab/window so that the developer
   * can go back and forth between making changes and see the result in a full
   * window
   */

  async newWindow() {
    // window has not been created or has been closed
    if (!this.newWin || this.newWin.closed) {
      this.newWin = window.open(`/page/${this.name}`, this.name);
      // TODO, ideally it'd tell us when it's loaded and we wouldn't have to wait
      await this.glob.sleep(1000);
    }

    this.broadcastChannel.postMessage({
      text: this.text,
    });
  }

  /*
   * Set the primary language of the page:
   * javascript or markdown
   * This only affects syntax highlighting
   */
  setLanguage() {
    const options = this.editorOptions;
    this.editorOptions = {
      theme: options.theme,
      language: this.language,
      wordWrap: options.wordWrap,
      tabSize: options.tabSize,
      minimap: options.minimap,
    };
  }
}
