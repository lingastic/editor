import { Component, ViewChild, OnInit, AfterViewInit } from '@angular/core';
import { FieldTypeConfig } from '@ngx-formly/core'; // Adjusted to import from '@ngx-formly/core'
import { FieldType} from '@ngx-formly/material'; // Adjusted to import from '@ngx-formly/core'
import { MatInput } from '@angular/material/input';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Observable } from 'rxjs';
import { startWith, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-formly-autocomplete-type',
  template: `
    <input
      matInput
      [matAutocomplete]="auto"
      [formControl]="formControl"
      [formlyAttributes]="field"
    />
    <mat-autocomplete #auto="matAutocomplete" [displayWith]="templateOptions.displayWith">
      <mat-option *ngFor="let value of filter | async" [value]="value">
        {{ value.rowString }}
      </mat-option>
    </mat-autocomplete>
  `,
})
export class AutocompleteTypeComponent
  extends FieldType<FieldTypeConfig>
  implements OnInit, AfterViewInit
{
  @ViewChild(MatInput) formFieldControl: MatInput;
  @ViewChild(MatAutocompleteTrigger) autocomplete: MatAutocompleteTrigger;

  filter: Observable<any>;

  get templateOptions() {
    return this.field.props || {};
  }

  ngOnInit() {
    this.filter = this.formControl.valueChanges.pipe(
      startWith(''),
      switchMap((term) => this.templateOptions.filter(term))
    );
  }

  ngAfterViewInit() {
    // temporary fix for https://github.com/angular/material2/issues/6728
    // (<any>this.autocomplete)._formField = this.formField;
  }
}
