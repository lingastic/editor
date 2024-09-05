import { Component } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { GlobService } from '../../glob.service';
import { NGXLogger, NgxLoggerLevel } from 'ngx-logger';
import { UntypedFormControl, Validators } from '@angular/forms';
import { UntypedFormGroup } from '@angular/forms';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { AccountService } from '../account.service';
import { Location } from '@angular/common';
import { SchemaService } from '../../utils/schema.service';
import { MiscService } from '../../utils/misc.service';
import { MatDialogRef } from '@angular/material/dialog';

const USER_INFO = 'user_info';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  glob;
  header: HttpHeaders = new HttpHeaders({});
  fields: FormlyFieldConfig[] = [];
  formControl = new UntypedFormControl('', [Validators.required]);
  form = new UntypedFormGroup({});
  model: Object = {}; // Model for the form

  constructor(
    private dialogRef: MatDialogRef<LoginComponent>,
    private globService: GlobService,
    private http: HttpClient,
    private logger: NGXLogger,
    private accountService: AccountService,
    private location: Location,
    public schemaService: SchemaService,
    public miscService: MiscService
  ) {
    this.glob = globService;
    const field: FormlyFieldConfig = {};
    const currPath = this.location.path();
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
    ];
  }

  login(): void {
    const credentials = {
      email: this.model['email'],
      pass: this.model['password'],
    };
    this.http
      .post(`${this.glob.api.url}/function/cdbfly.login`, credentials)
      .subscribe(
        data => {
          const userInfo = {
            jwt: data[0].token,
            email: this.model['email'],
          };
          this.logger.debug('login', data);
          this.accountService.setUserInfo(userInfo);
          this.schemaService.parseSchema(); // Reload schema info now that we're logged in
          window.location.href = '/'; // Force reload to refresh display of schema
        },
        (error: HttpErrorResponse) => {
          this.miscService.handleHttpError(error);
        }
      );
    this.dialogRef.close(this.model);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
