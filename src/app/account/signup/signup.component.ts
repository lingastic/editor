import { Component } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { UntypedFormGroup } from '@angular/forms';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css'],
})
export class SignupComponent {
  form = new UntypedFormGroup({});
  error = '';
  fields: FormlyFieldConfig[] = [];
  model: Object = {}; // Model for the form
  constructor(private dialogRef: MatDialogRef<SignupComponent>) {
    this.fields = [
      {
        key: 'email',
        type: 'input',
        templateOptions: {
          type: 'string',
          label: 'Email',
          placeholder: 'Enter your email',
          required: true,
        },
      },
      {
        key: 'password',
        type: 'input',
        templateOptions: {
          type: 'password',
          label: 'Password',
          placeholder: 'Enter your password',
          required: true,
        },
      },
      {
        key: 'password2',
        type: 'input',
        templateOptions: {
          type: 'password',
          label: 'Password Again',
          placeholder: 'Enter your password',
          required: true,
        },
      },
    ];
  }

  signup() {
    if (this.model['password'] !== this.model['password2']) {
      this.error = "passwords don't match";
      return;
    }
    const credentials = {
      email: this.model['email'],
      pass: this.model['password'],
    };
    this.dialogRef.close(this.model);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
