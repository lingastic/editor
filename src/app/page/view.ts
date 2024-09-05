import {
  Component,
  Input,
  OnChanges,
  ViewChild,
  NgZone,
  OnInit,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { DataService } from '../result-set/data.service';
import { PageDataService, Tile } from './data.service';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { GlobService, tableName } from '../glob.service';
import { SideNavComponent } from '../side-nav/side-nav.component';
import { MatSelectModule } from '@angular/material/select';
import { BroadcastChannel } from 'broadcast-channel';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { MarkdownAlertComponent } from './alert';
import { MarkdownModule, MarkdownService } from 'ngx-markdown';
import * as queryBuilder from 'sql-bricks-postgres';
import { io } from 'socket.io-client';

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
  selector: 'app-page-view',
  templateUrl: './view.html',
  styleUrls: ['./page.css'],
})
export class PageViewComponent implements OnInit {
  @Input() inputName: string;
  cols = COLS;
  multiplier = 1;
  glob;
  output = ''; // The output of the page
  name = ''; // The name of the page in the table
  originalName = ''; // The original name of the page when we use templates
  error = null; // Errors in processing
  text = ''; // text in the editor
  fileType = ''; // DIR, javascript, markdown, etc
  tiles: Tile[] = []; // tiles in the dashboard
  broadcastChannel: BroadcastChannel; // To communicate with other tabs
  isLoading = false; // for loading indicator
  socket;

  constructor(
    private dataService: DataService,
    private domSanitizer: DomSanitizer,
    private pageDataService: PageDataService,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private globService: GlobService,
    private breakpointObserver: BreakpointObserver,
    private zone: NgZone,
    private sideNavComponent: SideNavComponent,
    private markdownService: MarkdownService
  ) {
    this.glob = this.globService;
    this.socket = io(this.glob.api.url);
    this.socket.on('page changed', name => {
      // if the name of the page that changed is this one, reload it
      if (this.name === name) {
        this.loadText();
        this.broadcastChannel = new BroadcastChannel(`changed-${this.name}`);
      }
    });
  }

  ngOnInit() {
    this.pageDataService.configMakrdown(this.markdownService);
    this.loadPage();
  }

  loadPage() {
    // When inputName is true, it means that this is a child directive.
    // which means we load the page in the inputName, not in the url
    if (this.inputName) {
      this.name = this.inputName;
      this.loadText();
      this.broadcastChannel = new BroadcastChannel(`changed-${this.name}`);
    } else {
      /*
       * the route /pageedit/cdbfly/tutorial/links will have the segments
       * ['pageedit','cdbfly', ,tutorial' ,links']
       */

      // '/pageedit' means edit the page '/page' means view it
      this.route.url.subscribe(routeSegments => {
        const path = routeSegments.slice(1); // remove 'page'element
        this.name = '/' + path.join('/');
        // Ugly ways to strip query params when the '?' is escaped
        this.name = this.name.replace(/%3F.*$/, '');
        this.loadText();
        this.broadcastChannel = new BroadcastChannel(`changed-${this.name}`);
      });
    }
    this.makeResponsive();
  }

  /*
   * when we're doing the update or view load the text from
   * the db. Otherwise, we're creating a new page.
   */
  async loadText() {
    this.isLoading = true; // Lading indicator on

    if (!this.inputName) {
      await this.checkTemplate();
    }
    /*
     * TODO: We can do checkTemplate and fetch the page at he same time
     select * from
     (
     select page.name as page_name, template.* from cdbfly.page left outer join  cdbfly.template on page.name ~ template.regex and page.name <> template_page
     ) page
     where page_name = 'staff.home';
     */
    const query = queryBuilder
      .select('*')
      .from(tableName.PAGE)
      .where('name', this.name);
    const result = await this.dataService.doSqlSync(query.toString());
    if (result[0]) {
      this.text = result[0].text;
      this.name = result[0].name;
      this.fileType = result[0].language;
    } else {
      this.error = `Page '${this.name}' does not exist`;
      this.isLoading = false; // Lading indicator off
      return;
    }

    // just show the output of the page
    await this.run();
    this.isLoading = false; // Lading indicator off
    // And subscribe to messages telling us to refresh the content
    // when this content was editted in another tab
    this.broadcastChannel.onmessage = message => {
      this.text = message.text;
      this.run();
    };
  }

  async run() {
    const pageDataService = this.pageDataService;
    await this.pageDataService.run(this.text, this.name, this.fileType);
    this.error = pageDataService.error;
    this.output = pageDataService.output;
    const displayMenu = pageDataService.displayMenu;
    if (displayMenu !== undefined) {
      this.sideNavComponent.setDisplay(displayMenu);
    }
    const tiles = this.pageDataService.tiles;
    for (let ii = 0; ii < tiles.length; ii++) {
      const tile = tiles[ii];
      // if this.originalName it means that we're using a template
      // and need to put it in the placeholder tile
      if (tile.placeHolder && this.originalName !== '') {
        if (this.originalName === this.name) {
          delete tile.placeHolder;
          tile.content = `
          \`\`\`alert-warn
          This is a template. The actual content goes in here, when you apply the template to a page.
          \`\`\`
          See [the cdbfly template documentation](/page/cdbfly/docs/templates), for more info.
          `;
        } else {
          tile.placeHolder = this.originalName;
        }
      }
    }
    const that = this;
    // Set up for local links inside a page
    // See also renderer.link() in data.services.ts
    window['cdbfly']['navigate'] = function(href, opts?) {
      that.zone.run(() => {
        that.navigate(href, opts);
      });
    };
    // Need the zone so that when we receive a broadcast
    // the content actually gets updated
    this.zone.run(() => (that.tiles = that.pageDataService.tiles));
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

  // helper function to calculate the width of a tile
  colCalculate(cols) {
    return Math.min(cols * this.multiplier, COLS);
  }

  /*
   * Check to see if the page has a template by matching with the regex.
   * If it does, the template becomes the main page and the original page is inserted in the
   * "placeHolder" tile
   */
  async checkTemplate() {
    const query = `select * from ${tableName.TEMPLATE} where  '${this.name}' ~ regex`;
    const result = await this.dataService.doSqlSync(query);
    if (result[0]) {
      this.originalName = this.name;
      this.name = result[0].template_page;
    }
  }

  navigate(link, options?) {
    if (link) {
      let fullOpts = {};
      let relative = {};
      if (options) {
        fullOpts = options;
      }
      fullOpts['relativeTo'] = this.route;
      if (!link.startsWith('/')) {
        /* For relative routes, need to prepend '../' to the link since if our current route
         * is /a/b/c/d, and we're trying to go to /a/b/c/d/e, this.route points to /a/b/c/d,
         * the leaf/file, not /a/b/c, the branch/directory.
         */
        link = '../' + link;
        relative = { relativeTo: this.route };
      }
      this.router.navigate([link], fullOpts);
    }
  }
}
