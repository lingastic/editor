import { Injectable, NgZone } from '@angular/core';
import { DataService } from '../result-set/data.service';
import * as ejs from 'ejs';
import * as include from './include.js';
import * as queryBuilder from 'sql-bricks-postgres';
import { GlobService, tableName } from '../glob.service';
import * as path from 'path-browserify';

/*
 * data representation of a tile in the UI
 * Depending on the content we know what kind
 * of tile it is.
 */
export interface Tile {
  cols: number; // Number of cols the
  rows: number;
  relation?: string;
  relProps?: object;
  title?: string;
  content?: string;
  chartQuery?: string; // Query to construct a chart
  chartTitle?: string; // Title of the chart
  placeHolder?: string; // Title of the chart
  tree?: object;
}

@Injectable({
  providedIn: 'root',
})
export class PageDataService {
  output = ''; // The output of the page
  error = null; // Errors in processing
  text = ''; // text in the editor
  name = ''; // name of the page being processed
  tiles: Tile[] = []; // tiles in the dashboard
  fileType: string;
  displayMenu: undefined | boolean = undefined;
  constructor(private dataService: DataService, private zone: NgZone) {}

  /**
   * Run -- render the output of the page
   * 1. First include any pages, recursively
   * 2. First pass ejs to see if we have any queries. If we do, we run them
   * and await till we have the result.
   * 3. Second pass ejs, we provide the query result and do standard ejs rendering
   * 4. Use marked to parse the markdown
   */
  async run(text: string, name: string, fileType: string) {
    this.error = null;
    this.fileType = fileType;
    this.name = name;
    this.output = '';
    this.text = '';
    this.tiles = [];
    const data = {
      queries: {},
      results: null,
      tiles: [],
      displayMenu: undefined,
    };

    let fullText = '';

    // First pass, collect the queries if any
    try {
      if (fileType === 'DIR') {
        await this.showDir();
        return;
      } else {
        if (fileType === 'js') {
          fullText = this.handleJs(text);
          /* We don't need to handle includes since javascript files can't include others, though they
           * can be included in them
           */
        } else {
          const includeStack = {};
          includeStack[name] = 0;
          fullText = await this.handleIncludes(name, text, includeStack);
        }
      }
      ejs.render(fullText, data);
    } catch (err) {
      // This will cause the error to display in the UI
      this.error = err;
      return;
    }

    // We pass the query results in here
    data.results = {};

    // Let's run the queries
    for (const key in data.queries) {
      const value = data.queries[key];
      const result: any = await this.dataService.doSqlSync(value);
      // Put the query result in results
      const resultEntries = (<any>Object).entries(result[0]);
      if (result.length === 1 && resultEntries.length === 1) {
        data.results[key] = resultEntries[0][1];
      } else {
        data.results[key] = result;
      }
    }

    // Second pass, actually handle the output
    data.tiles = [];
    try {
      // the output is rendered in "<marked>" which converts the markdown
      this.output = ejs.render(fullText, data);
      if (data.tiles && data.tiles.length > 0) {
        this.tiles = data.tiles;
      }
      this.displayMenu = data.displayMenu;
    } catch (err) {
      this.error = err;
    }
  }

  /**
   * Custom configuration of the markdown
   * @param {markdownService} Object -- The marked editor object
   * See https://marked.js.org/using_pro#renderer for the different elements that
   * can be adapted.
   */
  configMakrdown(markdownService) {
    const that = this;
    const renderer = markdownService.renderer;
    /*
     * Image handling
     * Add support for image size
     */
    renderer.image = function(href, title, text) {
      let sizeStr = '';
      if (title) {
        const size = title.split('x');
        if (size[1]) {
          sizeStr = 'width=' + size[0] + ' height=' + size[1];
        } else {
          sizeStr = 'width=' + size[0];
        }
      }
      return '<img src="' + href + '" alt="' + text + '" ' + sizeStr + '>';
    };

    /**
     * Syntax highlighting
     * and alerts
     */
    renderer.code = function(code: string, lang: string, escaped: boolean) {
      let output = '';
      let cssClass = '';
      if (lang === 'ignore-markdown') {
        return code;
      }
      if (lang && lang.startsWith('alert-')) {
        return that.markdownAlerts(code, lang);
      } else {
        cssClass = ` language-${lang}`;
        if (lang === 'html') {
          // to have the html show correctly https://stackoverflow.com/a/15607186/460278
          code = code.replace(/\</g, '&lt;');
        }
        output = `
        <div>
          <pre class="${cssClass}"><code class="${cssClass}">${code}</code></pre>
        </div>
			`;
      }
      return output;
    };

    /**
     * Local URLs use angular to navigate to the page without refreshing
     */

    renderer.link = function(href: string, title: string, text: string) {
      // From https://stackoverflow.com/questions/10687099/how-to-test-if-a-url-string-is-absolute-or-relative
      if (href.indexOf('://') > 0 || href.indexOf('//') === 0) {
        // external url
        return `<a href="${href}" title="${title}">${text}</a>`;
      } else {
        // local url
        // basically do cdbfly.zone.run(() => (cdbfly.navigate(hrefur));
        // cdbfly.navigate is created in view.ts, and uses the router to navigate
        // to a new page.
        return `<a href="${href}" onclick="javascript:cdbfly.navigate('${href}'); return false;" title="${title}">${text}</a>`;
      }
    };
  }

  /**
   * Provide a way to create alerts similar to
   * https://getbootstrap.com/docs/4.0/components/alerts/
   * https://confluence.atlassian.com/doc/info-tip-note-and-warning-macros-51872369.html
   */
  markdownAlerts(code: string, lang: string) {
    let alertType = '';
    let icon = '';
    switch (lang) {
      case 'alert-error':
        alertType = 'error';
        icon = 'error';
        break;
      case 'alert-info':
        alertType = 'info';
        icon = 'info';
        break;
      case 'alert-warn':
        alertType = 'warn';
        icon = 'warning';
        break;
      case 'alert-success':
        alertType = 'success';
        icon = 'done';
        break;
    }
    const output = `
        <div class="alert ${alertType}">
          <span>
            <mat-icon aria-label="Save" class="mat-icon material-icons">
              ${icon}
            </mat-icon>
          </span>
        <span class='text'>
        ${code}
        </span>
        </div>
        `;
    return output;
  }

  /*
   * ejs doesn't let us fetch include from the db in an async manner
   * instead use our own parser to find the includes and then get them.
   * 1. We parse the list of includes in a page
   * 2. We fetch the text of the pages from the db
   * 3. For each include we call this function recursively to fetch includes in it
   * 4. We reparse the page passing the included page and the parser replaces
   * the include statement with the actual text
   * 5. We return the resulting text
   * @param {pagePath} String -- The path/name of the page
   * @param {text} String -- The text that needs to be parsed
   * @param {includeStack} Object -- set of page names that have been seen in the recursive call.
   * Used to avoid an infinite recursive loop where A includes B and B includes A.
   *
   */

  async handleIncludes(pagePath: string, text: string, includeStack: object) {
    let includes = {}; // include statements in the ejs

    // first parse the includes from the page
    const result = include.parse(text, { includes: includes });
    if (result.includes.length < 1) {
      return text; // no includes, nothing to do
    }
    const resolvedIncludes = this.resolvePath(result.includes, pagePath);

    // create a string of all the includes
    let resolvedList = [];

    // create a list of all the includes
    resolvedIncludes.forEach((inc: object) => {
      resolvedList.push(inc['full']);
    });

    // fetch the all the includes in the page from the db
    const query = queryBuilder
      .select('name', 'text', 'language')
      .from(tableName.PAGE)
      .where(queryBuilder.in('name', resolvedList));
    const incPages = <any>await this.dataService.doSqlSync(query.toString());

    // Convert the array into an object with the page's text for easy lookup
    for (const ii in incPages) {
      const page = incPages[ii];
      if (page.language === 'js') {
        page.text = this.handleJs(page.text);
      }
      includes[page.name] = page.text;
    }

    // Traverse the array and make sure we got all tha pages
    for (const jj in resolvedIncludes) {
      const name = resolvedIncludes[jj]['full'];
      if (!includes[name]) {
        this.error = `included page "${name}" does not exist. Stack of includes: ${JSON.stringify(
          includeStack
        )}`;
        throw this.error;
        return '';
      }
      const pageText = includes[name];
      // recursively check if the included page has includes as well
      // but make sure that a page doesn't recursively include itself
      if (includeStack[name]) {
        // this page has already been included
        this.error = `include page "${name}" is included recursively, stack position of includes: ${JSON.stringify(
          includeStack
        )}`;
        throw this.error;
        return '';
      }
      // Add this page and its position in the stack for error reporting above
      includeStack[name] = Object.keys(includeStack).length;
      // And call recursively
      includes[name] = await this.handleIncludes(
        name,
        includes[name],
        includeStack
      );
      // Once we handled the page, remove it from the "stack"
      delete includeStack[name];
    }

    // Parse again but this time provide the text of the includes
    // results in the includes inlined in the page
    // change includes so that it points to the original include
    // by traversing the resolvedIncludes array
    resolvedIncludes.forEach((inc: object) => {
      includes[inc['original']] = includes[inc['full']];
      delete includes[inc['full']];
    });

    const withIncludes = include.parse(text, { includes: includes });

    return withIncludes.text;
  }

  /*
   * resolve relative paths in includes
   * @param {includes} Array of strings -- The includes
   * @param {baseFile} String -- The path of the file that is including
   * @return {Array} Array of objects with the original and full paths
   * For each include, if it's a relative path, we resolve it relative to the
   * baseFile. If it's an absolute path, we leave it as is.
   * We return an array of objects with the original and full paths
   */
  resolvePath(includes, baseFIle) {
    const result = [];
    let newInclude = include;
    includes.forEach(include => {
      if (!path.isAbsolute(include)) {
        newInclude = path.resolve(path.dirname(baseFIle), include);
      }
      result.push({ original: include, full: newInclude });
    });
    return result;
  }

  /*
   * If it's a javascript file, we simply enclose it in EJS delimiters and treat it as a
   * ejs file, which we already handle.
   */
  handleJs(text: string) {
    return `
          <%
          ${text}
          %>
          `;
  }

  /*
   * For a directory, we show the directory of pages under it.
   */
  async showDir() {
    const tree = [];
    const rootDir = this.name;
    // Get all the pages under this dir
    const query = `select regexp_replace(name, '${rootDir}', '') as name from cdbfly.page where name ~ '^${rootDir}.*' order by 1`;
    const results: any = await this.dataService.doSqlSync(query);

    if (results) {
      // build the JSON tree of docs based on the query result
      let parents = {}; // object that lets us lookup parents easily
      // traverse all pages
      results.forEach(page => {
        if (page.name === '') {
          page.name = '/';
        }
        const parsed = path.parse(page.name);
        const url = `/page/${rootDir}${page.name}`;
        // page names are grandparent/parent/child. Like dirs.
        // for each node create an object describing it and the link when clicked
        const pageObject = {
          name: parsed.name,
          fullName: `${rootDir}${page.name}`,
          children: [],
          url: url,
        };
        if (parsed.dir === '/') {
          // we're at the root of the tree
          tree.push(pageObject);
          parents[page.name] = pageObject;
        } else {
          const parent = parents[parsed.dir];
          parent.children.push(pageObject);
          parents[page.name] = pageObject;
        }
      });

      tree[0].name = rootDir;

      this.tiles = [
        {
          cols: 12,
          rows: 4,
          title: '',
          tree: {
            data: tree,
          },
        },
      ];
    }
  }
}
