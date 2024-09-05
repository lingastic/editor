import { Component } from '@angular/core';
import { FieldTypeConfig } from '@ngx-formly/core'; // Adjusted to import from '@ngx-formly/core'
import { FieldType} from '@ngx-formly/material'; // Adjusted to import from '@ngx-formly/core'

// Create an interface for the template options
export interface FileTemplateOptions {
  onUploadChange: (file: File) => void;
}

// Create a config interface extending FieldTypeConfig with custom template options
export interface FileFieldConfig extends FieldTypeConfig {
  templateOptions: FileTemplateOptions;
}

@Component({
  selector: 'app-formly-field-file',
  template: `
    <input
      (change)="onChange($event)"
      type="file"
      [formControl]="formControl"
      [formlyAttributes]="field"
    />
  `,
})
export class FileComponent extends FieldType<FileFieldConfig> {
  constructor() {
    super();
  }

  onChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file && this.field.templateOptions?.onUploadChange) {
      this.field.templateOptions.onUploadChange(file);
    }
  }
}
