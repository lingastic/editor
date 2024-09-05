import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTable } from '@angular/material/table';
import { Inject, AfterViewInit, Component, ViewChild } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { FormGroup } from '@angular/forms';
import { NGXLogger, NgxLoggerLevel } from 'ngx-logger';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { MatTableDataSource } from '@angular/material/table';
import { GlobService } from '../glob.service';

/**
 * @title view a table/view row
 */

@Component({
  selector: 'app-view-sub-account',
  templateUrl: 'view.html',
  styleUrls: ['./result-set.component.css'],
})
export class ViewDialogComponent implements AfterViewInit {
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  @ViewChild(MatTable) table: MatTable<any>;
  dataSource = new MatTableDataSource([]);
  displayedColumns: string[];

  constructor(
    public dialogRef: MatDialogRef<ViewDialogComponent>,
    private logger: NGXLogger,
    private globService: GlobService,
    @Inject(MAT_DIALOG_DATA) public data: Object
  ) {
    const columns = data['tableInfo']['columns'];
    const cols = [];
    for (const col of columns.values()) {
      cols.push(col);
    }
    this.displayedColumns = ['name', 'value'];
    const rowInfo = data['row'];
    const tableData = [];
    for (const col of Object.keys(rowInfo)) {
      const currCol = {
        name: globService.prettyWords(col) + ':',
        value: rowInfo[col],
      };
      tableData.push(currCol);
    }
    this.dataSource.data = <any>tableData;
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
    this.table.dataSource = this.dataSource;
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
