import {
  Component,
  ViewChild,
  Input,
  OnChanges,
  NgZone,
  AfterViewInit,
} from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTable } from '@angular/material/table';
import { MatTableDataSource } from '@angular/material/table';
import { GlobService, tableName } from '../glob.service';
import { Router, ActivatedRoute, NavigationExtras } from '@angular/router';
import { DeleteDialogComponent } from './delete-dialog-component';
import { ViewDialogComponent } from './view-dialog-component';
import { MatDialog } from '@angular/material/dialog';
import { NGXLogger } from 'ngx-logger';
import { SchemaService } from '../utils/schema.service';
import { CreateDialogComponent } from './create-dialog-component';
import { DataService } from './data.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MiscService } from '../utils/misc.service';

/**
 * @title resultset
 * Displays a relation: a table or a view with filtering and sorting
 * CRUD operations when appropriate based on the user's permissions:
 * Create: a new row
 * Read: view the list of rows
 * Update: an existing row
 * Delete: an existing row
 *
 * The relation is defined either in the url as param or passed in an an arg
 * when the component is initiated.
 */

@Component({
  selector: 'app-result-set',
  templateUrl: './result-set.component.html',
  styleUrls: ['./result-set.component.css'],
})
export class ResultSetComponent implements OnChanges, AfterViewInit {
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  @ViewChild(MatTable) matTable: MatTable<any>;
  @Input() relName: string;
  @Input() relProps: any; // additional properties passed from a cdbfly page to customize the result set

  dataSource = new MatTableDataSource([]);
  isLoading = false;
  glob: any;
  relationName: string;
  tableInfo: Object;
  displayedColumns: string[];
  query = ''; // Query to pass to the postgrest requests
  columnsInfo = {};
  paging = {
    length: 0, // Total number of rows
    pageIndex: 0, // What page are we on
    pageSize: 10, // Rows per page
  }; // Paging info see https://material.angular.io/components/paginator/api#PageEvent
  sorting = {
    column: null, // column we're sorting by
    direction: 'asc', // By default it's asc, but can be changed to desc
  };
  searchTerm = '';
  relQuery = ''; // Used when we're passed a subquery and no relation name

  constructor(
    private zone: NgZone,
    private globService: GlobService,
    private route: ActivatedRoute,
    public dialog: MatDialog,
    private logger: NGXLogger,
    private schemaService: SchemaService,
    public miscService: MiscService,
    private router: Router,
    private dataService: DataService,
    private snackBar: MatSnackBar
  ) {
    if (this.relName) {
      this.relationName = this.relName;
    }
    this.glob = globService;

    this.route.params.subscribe((params) => {
      this.reset();

      const isResultSetPage = this.route.url['value'][0].path === 'resultSet';
      if (params.id && isResultSetPage) {
        this.relationName = params.id;
      }
      if (this.relationName) {
        this.displayRelation();
      } else {
        this.fetchAndDisplay();
      }
    });
  }

  /**
   * Display a relation: a database table or view
   */
  displayRelation() {
    this.query = this.route.snapshot.queryParamMap.get('query');

    const relations = this.schemaService.getRelations();
    // Get the table and its columns info from the metadata
    this.tableInfo = relations.get(this.relationName);

    // We're passed a query in the tile, so we don't need to fetch the table info
    if (this.relProps && this.relProps.query) {
      this.relQuery = this.relProps.query;
      //this.tableInfo = {};
      this.fetchAndDisplay();
      return;
    }
    if (!this.tableInfo) {
      this.snackBar.open(
        `Error: You have no permission to view "${this.relationName}"`,
        'Dismiss',
        { duration: 3000 }
      );
      return;
    }
    const cols = this.tableInfo['columns'];
    // Convert from map to object
    for (const val of cols.values()) {
      this.columnsInfo[val.name] = val;
    }
    this.logger.debug(this.columnsInfo);
    this.fetchAndDisplay();
  }

  ngOnChanges(changes: any) {
    if (changes.relName && changes.relName.firstChange) {
      this.relationName = changes.relName.currentValue;
      this.displayRelation();
    }
  }

  ngAfterViewInit() {
    if (!window['cdbfly']) {
      window['cdbfly'] = {};
    }
    /*
     * Create a hook for cdbfly pages to perform sql queries
     * They can then run it doing something like
     * cdbfly.sql(query) which will run in this context
     */
    // window['cdbfly'].queryZone = this.zone;
    const that = this;
    window['cdbfly'].sql = function (queryObj: any) {
      that.zone.run(() => {
        that.doSql(queryObj);
      });
    };

    this.dataSource.sort = this.sort;
    this.matTable.dataSource = this.dataSource;
    this.paginator.page.subscribe((data) => {
      this.handlePagEvent(data);
    });
    this.sort.sortChange.subscribe((data) => {
      this.handleSortEvent(data);
    });
  }

  /**
   * Fetch the info for a relation and display it in Angular Material table
   * The details like paging info and sorting are passed in in class variables.
   * TODO: migrate to building the query with databricks or knex
   */

  async fetchAndDisplay() {
    let sortingParam = '';
    let query = ' where 1=1 ';
    this.isLoading = true;
    const pagingOffset = this.paging.pageSize * this.paging.pageIndex;
    if (this.query) {
      query += `and ${this.query}`;
    }
    if (this.searchTerm && this.searchTerm !== '') {
      query += `and subquery::text ~* '.*${this.searchTerm}.*' `;
    }

    if (this.sorting.column) {
      sortingParam = ` order by ${this.sorting.column} ${this.sorting.direction}`;
    }

    let baseQuery = '';

    if (this.relQuery) {
      // if we are passed a query, we use it as a subquery to select from.
      // This way paging and searches work correctly
      baseQuery = ` * from (${this.relProps.query}) as subquery ${query}  ${sortingParam} offset ${pagingOffset} limit ${this.paging.pageSize}`;
    } else {
      if (!this.relationName) {
        // no relProps and no relationName, we're done.
        return;
      }
      baseQuery = ` * from (select * from ${this.relationName}) as subquery ${query}  ${sortingParam} offset ${pagingOffset} limit ${this.paging.pageSize}`;
    }
    const queryResult = await this.dataService.doSqlWithCount(baseQuery);

    const res = <any>queryResult['data'];
    if (res.length === 0) {
      this.isLoading = false;
      this.dataSource.data = [];
      return; // no rows, we're done
    }
    this.displayedColumns = Object.keys(res[0]);
    // Only display the actions column if we're got a relation name. If it's a query, we don't
    if (this.relationName) {
      this.displayedColumns.splice(0, 0, 'actions');
    }
    // asked to add an extra column to the result set. Set the title of the column. The content is
    // set in the HTML
    if (this.relProps && this.relProps.column) {
      this.displayedColumns.push(this.relProps.column.title);
    }
    this.dataSource.data = <any>res;
    this.formatDataSource();

    this.paging.length = queryResult['count'];
    this.isLoading = false;
  }

  doSearch() {
    this.fetchAndDisplay();
  }

  /*
   * delete
   * Show a dialog and on confirm. Call the dataService to delete from the db
   * @param {row} Object -- the row we're deleting
   */
  deleteItem(row: any) {
    this.logger.debug(row);
    row['primaryKeyField'] = this.tableInfo['primaryKey'];
    if (!row['primaryKeyField']) {
      this.snackBar.open(
        `Error: "${this.relationName}" does not have a primary key. Can't delete!`,
        'Dismiss',
        { duration: 5000 }
      );
      return;
    }

    const rowData = {
      row: row,
      table: this.relationName,
    };
    const dialogRef = this.dialog.open(DeleteDialogComponent, {
      data: rowData,
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.dataService.delete(this.tableInfo, result, () => {
          this.refreshFromServer();
        });
      }
    });
  }

  /*
   * Add/insert
   * Show a dialog and input the info and on submit send to the dataService to
   * add to the db
   */
  async addItem() {
    // Pages are special and have a special UI
    if (this.relationName === tableName.PAGE) {
      const pageName = await this.genNewName();
      this.router.navigate([`/pageedit/${pageName}`], {
        queryParams: { insert: true },
      });
      return;
    }
    const dialogRef = this.dialog.open(CreateDialogComponent, {
      panelClass: 'input-dialog',
      data: {
        tableInfo: this.tableInfo,
      },
    });
    dialogRef.afterClosed().subscribe(async (result) => {
      this.logger.debug('result', result);
      if (result) {
        if (result['uploadFile']) {
          this.isLoading = true;
          try {
            await this.dataService.sendFile(result['uploadFile']);
            this.isLoading = false;
            this.refreshFromServer();
          } catch (err) {
            this.isLoading = false;
          }
        } else {
          this.refreshFromServer();
        }
      }
    });
  }

  /*
   * Update
   * Show a dialog and on update the reader's info
   * @param {row} Object -- the row we're updating
   */
  async updateItem(row: any) {
    // pages are treated differently than standard rows
    //  Click on update goes to the pageedit page
    if (this.relationName === tableName.PAGE) {
      this.miscService.changeLocation(`/pageedit/${row['name']}`);
      return;
    }

    const primaryKey = this.tableInfo['primaryKey'];
    if (!primaryKey) {
      this.snackBar.open(
        `Error: "${this.relationName}" does not have a primary key. Can't update!`,
        'Dismiss',
        { duration: 5000 }
      );
      return;
    }

    const value = row[primaryKey];
    const getOriginalRow = `select * from ${this.relationName} where ${primaryKey} = '${value}'`;
    const newRow = await this.dataService.doSqlSync(getOriginalRow);

    // Clone the object. If we use the original the data gets updated in real time
    // when the user changes it even if they click cancel.
    const updateRow = Object.assign({}, newRow[0]);
    const dialogRef = this.dialog.open(CreateDialogComponent, {
      panelClass: 'input-dialog',
      data: {
        tableInfo: this.tableInfo,
        row: updateRow,
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.refreshFromServer();
      }
    });
  }

  /**
   * Refresh the list from the server
   * We do this whenever we perform an operation
   * so the list is always correct
   */
  refreshFromServer() {
    this.fetchAndDisplay();
  }

  /**
   * follow Link to Foreign table
   * @param column -- the name of the column in the current table
   * @param id -- the actual value of the column in the current row
   * Example: column = customer_id and id = 269 creates this link:
   * /resultSet/customer?query=customer_id:eq.269
   * The syntax "customer_id:eq.269" is postgrest and passed to the server
   */

  foreignTableLink(column: any, id: any) {
    const foreignTable = this.columnsInfo[column].foreignKeyTab;
    const foreigncolumn = this.columnsInfo[column].foreignKeyCol;
    const foreignKeySchema = this.columnsInfo[column].foreignKeySchema;
    let link = `/resultSet/${foreignTable}`;
    /*
     * Special case for foreign keys pointing to files. use the specific page
     * we use to display info about files.
     */
    if (`${foreignKeySchema}.${foreignTable}` === tableName.FILE) {
      link = '/page/system/files';
    }
    this.logger.debug(link);
    const navigationExtras: NavigationExtras = {
      queryParams: { query: `${foreigncolumn}='${id}'` },
    };

    // Navigate to the foreign key row
    this.router.navigate([link], navigationExtras);
    return false;
  }

  /*
   * viewItem
   * Show a dialog with the detailed view of the item
   */
  viewItem(row: any) {
    // pages are treated differently than standard rows
    // Click on View shows the actual page.
    if (this.relationName === tableName.PAGE) {
      this.miscService.changeLocation(`/page/${row['name']}`);
      return;
    }

    this.dialog.open(ViewDialogComponent, {
      panelClass: 'input-dialog',
      maxHeight: '95vh',
      data: {
        tableInfo: this.tableInfo,
        row: row,
      },
    });
  }

  /*
   * Handle a page event:
   *   * Next/previous page
   *   * change page size
   * @param {pageEvent} PageEvent -- details of the event: see
   * https://material.angular.io/components/paginator/api#PageEvent
   *
   */
  handlePagEvent(pageEvent: PageEvent) {
    this.paging.pageSize = pageEvent.pageSize;
    this.paging.pageIndex = pageEvent.pageIndex;
    if (this.searchTerm) {
      // Search results paging
      this.doSearch();
    } else {
      // Regular table fetching
      this.fetchAndDisplay();
    }
  }

  /*
   * Handle a sort event, user clicks on a button on top of a column
   * @param {pageEvent} PageEvent -- details of the event: see
   * https://material.angular.io/components/paginator/api#PageEvent
   *
   */
  handleSortEvent(sortEvent: any) {
    this.sorting.column = sortEvent.active;
    this.sorting.direction = sortEvent.direction;
    this.paging.pageIndex = 0; // When we change the sort order we restart
    this.fetchAndDisplay();
  }

  clearSearch() {
    this.searchTerm = '';
    this.reset();
    this.fetchAndDisplay();
  }

  reset() {
    this.tableInfo = {}; // remove previous info
    this.paging = {
      length: 0, // Total number of rows
      pageIndex: 0, // What page are we on
      pageSize: 10, // Rows per page
    }; // Paging info see https://material.angular.io/components/paginator/api#PageEvent
    this.sorting = {
      column: null, // column we're sorting by
      direction: 'asc', // By default it's asc, but can be changed to desc
    };
    this.searchTerm = '';
  }

  canEditPageText() {
    return this.tableInfo['canUpdate'] && this.relationName === tableName.PAGE;
  }

  /**
   * invoked from a cdbfly page
   * @param queryOb includes these;
   * @param statement -- the query we're running as a prepared statement
   * @param values -- optional values to pass to the prepared statemtn
   * @param message -- message to display on success of operation
   * @param refresh: refresh the resulSet if t
   */
  async doSql(queryObj: any) {
    // This will throw an error and display a message on failure
    await this.dataService.doSqlSync(queryObj.statement, queryObj.values);
    if (queryObj.refresh) {
      this.refreshFromServer();
    }
    if (queryObj.message) {
      this.snackBar.open(queryObj.message, 'Dismiss', { duration: 3000 });
    }
  }

  // Generate a unique name for a new page: page-nnnnn
  async genNewName() {
    const query = `select max(substring(name, '^page-([0-9]*)')::int) as maxnum from ${tableName.PAGE}`;
    const result = await this.dataService.doSqlSync(query);
    let num = 1;
    if (result && result[0]) {
      num = result[0]['maxnum'] + 1;
    }
    return `page-${num}`;
  }

  formatDataSource() {
    const data = this.dataSource.data;
    if (!data || !data[0]) {
      return;
    }
    const row = data[0];
    Object.keys(this.columnsInfo).forEach((value) => {
      if (this.columnsInfo[value].colType === 'json') {
        row[value] = JSON.stringify(row[value]);
      }
    });
  }
}
