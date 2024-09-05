import {
  MatDialog,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { Component, Inject } from '@angular/core';
import { UntypedFormControl, Validators } from '@angular/forms';
import { UntypedFormGroup } from '@angular/forms';
import { NGXLogger, NgxLoggerLevel } from 'ngx-logger';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { GlobService, tableName } from '../glob.service';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { SchemaService, Col, Relation, ColType } from '../utils/schema.service';
import { DataService } from './data.service';
import * as validator from 'validator';

/**
 * @title Create or update a table/view
 * @description This component is used to create or update a table/view.
 */

@Component({
  selector: 'app-create-sub-account',
  templateUrl: 'create.html',
  styleUrls: ['./result-set.component.css'],
})
export class CreateDialogComponent {
  isUpdate = false; // True when it's an update, otherwise it's create
  model: Object = {}; // Model of the table
  formControl = new UntypedFormControl('', [Validators.required]);
  form = new UntypedFormGroup({});
  fields: FormlyFieldConfig[] = [];
  tableInfo: Object = {};
  columns: Col[];
  glob;
  oldRow: Object = {};

  constructor(
    public dialogRef: MatDialogRef<CreateDialogComponent>,
    private logger: NGXLogger,
    private globService: GlobService,
    private http: HttpClient,
    private dataService: DataService,
    @Inject(MAT_DIALOG_DATA) public data: Object
  ) {
    this.glob = globService;
    this.tableInfo = data['tableInfo'];
    this.columns = data['tableInfo']['columns'];
    if (data['row']) {
      this.isUpdate = true;
      this.model = data['row'];
      this.oldRow = data['row'];
    }
    this.setColumns();
  }

  /*
   * Set up the formly columns for input:
   * * file type
   * * validation
   * * ignore certain columns that shouldn't be user editable
   */
  async setColumns() {
    if (
      // we treat the cdbfly.file table differently for insert
      // the cdbfly.file.fsid column holds the random name for the file.
      `${this.tableInfo['schema']}.${this.tableInfo['name']}` ===
        tableName.FILE &&
      !this.isUpdate
    ) {
      this.fileTableInsert();
      return;
    }

    for (const column of this.columns.values()) {
      const colDefault: string = column.colDefault;
      const columnName = column.name;
      const nextVal = `nextval('${this.tableInfo['name']}_${column.name}_seq`;
      const colValidators = [];
      // Don't insert or update serial type
      if (colDefault && colDefault.startsWith(nextVal)) {
        // TODO:not fullproof https://dba.stackexchange.com/questions/90555/postgresql-select-primary-key-as-serial-or-bigserial/90567#90567
        continue;
      }

      // Full text search columns, not insertable or updatable
      if (column.colType === ColType.Tsvector) {
        continue;
      }

      // Timezone field that's automatically filled
      if (colDefault && colDefault.startsWith('now()')) {
        continue;
      }

      let inputType = 'input';
      let fieldType = 'string';
      const extraOptions: any = {};
      const valObject = null;

      if (
        // the cdbfly.file.fsid column holds the random name for the file.
        `${this.tableInfo['schema']}.${this.tableInfo['name']}` ===
          tableName.FILE &&
        column.name === 'fsid'
      ) {
        // don't allow updating of the id in the db of the file
        continue;
      }
      switch (column.colType) {
        case ColType.Boolean: {
          inputType = 'checkbox'; // can also be toggle
          break;
        }
        case ColType.Date: {
          inputType = 'input';
          extraOptions['type'] = 'date';
          break;
        }
        case ColType.Time: {
          inputType = 'input';
          extraOptions['type'] = 'time';
          break;
        }
        case ColType.Number: {
          fieldType = 'string';
          if (column.colTypeExtra === 'int') {
            const val = this.getValidationObject(
              validator.isInt,
              'is not an integer',
              false
            );
            colValidators.push(val);
          } else {
            const val = this.getValidationObject(
              validator.isNumeric,
              'is not a number',
              false
            );
            colValidators.push(val);
          }
          break;
        }
        case ColType.Uuid: {
          fieldType = 'string';
          const val = this.getValidationObject(
            validator.isUUID,
            'is not a UUID',
            column.required
          );
          colValidators.push(val);
          break;
        }
        case ColType.Json: {
          inputType = 'textarea';
          extraOptions['rows'] = 5;
          extraOptions['autosize'] = true;
          const val = this.getValidationObject(
            validator.isJSON,
            'is not valid JSON',
            column.required
          );
          colValidators.push(val);
          break;
        }
      }
      if (valObject) {
        colValidators.push(valObject);
      }

      let field: FormlyFieldConfig = {};
      if (column.foreignKeyCol) {
        const rowObj = {
          column: column,
          keyValue: this.model[column.name],
          rowString: '',
        };
        this.model[column.name] = rowObj;
        this.setAutocompleteModel(column);
        field = {
          key: columnName,
          type: 'autocomplete',
          templateOptions: {
            label: column.prettyName,
            placeholder: column.prettyName,
            required: true,
            filter: (term) => this.filterAutocomplete(term, column),
            displayWith: (item) => this.displayWith(item),
          },
        };
      } else {
        // not foreign key
        field = {
          key: columnName,
          type: 'textarea',
          // type: inputType,
          templateOptions: {
            type: fieldType,
            label: column.prettyName,
            rows: 5,
            autosize: true,
            placeholder: column.prettyName,
            required: column.required,
          },
          validators: colValidators,
        };
      }
      field.templateOptions = Object.assign(
        field.templateOptions,
        extraOptions
      );
      this.fields.push(field);
    }
  }

  /*
   * Handle the file table specially.
   * Just upload the files and figure out the mimetype and file name from the upload
   */
  fileTableInsert() {
    for (const column of this.columns.values()) {
      if (column.name !== 'fsid') {
        continue;
      }
      column.required = false;
      const field = {
        key: column.name,
        type: 'file',
        templateOptions: {
          type: 'string',
          label: column.prettyName,
          placeholder: column.prettyName,
          required: column.required,
          onUploadChange: (file) => {
            this.model['uploadFile'] = file;
          },
        },
      };
      this.fields.push(field);
      return;
    }
  }
  getErrorMessage() {
    return this.formControl.hasError('required')
      ? 'Required field'
      : this.formControl.hasError('email')
      ? 'Not a valid email'
      : '';
  }

  cancel(): void {
    this.dialogRef.close();
  }

  confirmCreate(): Promise<Object> {
    for (const column of this.columns.values()) {
      if (column['foreignKeyCol']) {
        // Foreign keys store in an object
        // both the string value and the key value in the model
        // When inserting into the db we need to use just the foreign key value
        this.model[column['name']] = this.model[column['name']]['keyValue'];
      }
    }
    this.logger.info('confirm', this.data);
    return new Promise(async (resolve, reject) => {
      try {
        if (this.isUpdate) {
          this.dataService.updateItem(
            this.tableInfo,
            this.model,
            this.oldRow,
            () => {
              this.dialogRef.close(this.model);
              resolve(this.model);
            }
          );
        } else {
          this.dataService.create(this.tableInfo['name'], this.model, () => {
            this.dialogRef.close(this.model);
            resolve(this.model);
          });
        }
      } catch (e) {
        console.error(e);
        reject(e);
      }
    });
  }

  /*
   * Filter foreign key using autocomplete
   * As the user types, we search the db for the
   * matching rows
   */
  filterAutocomplete(term: string, column: Object) {
    const tabName = this.tableInfo['name'];
    const foreignSchema = column['foreignKeySchema'];
    const foreignTab = column['foreignKeyTab'];
    const foreignCol = column['foreignKeyCol'];
    return new Promise(async (resolve) => {
      const query = `
      select * from ${foreignSchema}.${foreignTab} where ${foreignTab}::text ~* '.*${term}.*'
      limit 10 offset 0
      `;
      const data: any = await this.dataService.doSqlSync(query);
      let result = [];
      // for all rows in the result create a string
      result = data.map((row) => {
        const rowObj = {
          column: column,
          rowString: '',
          keyValue: null,
        };
        const rowValues = [];
        // For each key add the value as a string
        for (const key in row) {
          const value = row[key];
          rowValues.push(value);
          if (key === foreignCol) {
            rowObj.keyValue = value;
          }
        }
        rowObj.rowString = rowValues.join(', ');
        return rowObj;
      });
      resolve(result);
    });
  }

  displayWith(option: object) {
    if (!option) {
      return '';
    } else {
      const rowString = option['rowString'];
      if (rowString !== null && rowString !== '') {
        return rowString;
      } else {
        return option['keyValue'];
      }
    }
    /*
    const column = option['column'];
    const value = option['keyValue'];
    let rowString = '';
    if (!value || !this) {
      return rowString; // Field is empty, nothing to display
    }
    const query = `${column.foreignKeyCol}=eq.${value}`;
    const url = `${this.glob.api.url}/${column.foreignKeyTab}?limit=1&${query}`;
    this.http.get(url, {}).subscribe(res => {
      const data = <any>res;
      const row = data[0];
      if (row) {
        for (const key in row) {
          rowString += row[key] + ', ';
        }
      }
      const rowObj = {
        column: column,
        keyValue: rowString,
      };
    });
    return '';
    */
  }

  setAutocompleteModel(column: Col) {
    const value = this.model[column.name].keyValue;
    if (!value) {
      return; // Field is empty, nothing to display
    }
    const query = `
    select * from ${this.tableInfo['schema']}.${column.foreignKeyTab} where
    ${column.foreignKeyCol}='${value}'
    `;
    const url = `${this.glob.api.url}/sql`;
    this.http.post(url, { query }).subscribe((res) => {
      const data = <any>res;
      const row = data[0];
      let rowString = '';
      if (row) {
        for (const key in row) {
          rowString += row[key] + ', ';
        }
        // this.model[column.name] = rowString;
      }
      const currValue = this.model[column.name];
      this.model[column.name][rowString] = rowString;
    });
  }

  /**
   * Create a validation object for Formly
   * @param {validationFunc} function -- The function that does the validation
   * @param {errMessage} String -- The error message to display
   *
   */

  getValidationObject(validationFunc, errMessage, required) {
    return {
      // Per https://github.com/validatorjs/validator.js#strings-only
      // We coerce to to string by doing "+ ''"
      expression: function (valObject) {
        const value = valObject.value;
        if (
          !required &&
          (value === '' || value === null || value === undefined)
        ) {
          valObject.value = null;
          return true;
        }
        return validationFunc(value + '');
      },
      message: function (error, fd: FormlyFieldConfig) {
        let label = `"${fd.formControl.value}"`;
        // On certain errors angular changes the original values to null
        // So rather than being able to display "aaa is not an int"
        // We display "Field is not an int"
        if (label === '"null"') {
          label = 'Field';
        }
        return `${label} ${errMessage}`;
      },
    };
  }
}
