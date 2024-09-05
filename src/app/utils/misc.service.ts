import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { NGXLogger, NgxLoggerLevel } from 'ngx-logger';

@Injectable({
  providedIn: 'root',
})
export class MiscService {
  constructor(
    private router: Router,
    private logger: NGXLogger,
    private snackBar: MatSnackBar
  ) {}

  changeLocation(uri: string) {
    this.router
      .navigateByUrl('/', { skipLocationChange: true })
      .then(() => this.router.navigate([uri]));
  }

  /*
   * Handle a http error
   */
  handleHttpError(error: HttpErrorResponse) {
    this.logger.error(error);
    const postgresCode = error.error['postgresCode'];
    let postgresMesage = '';
    if (postgresCode) {
      // If we have a postgres code, include it
      postgresMesage = `Code:${postgresCode}`;
    }
    this.snackBar.open(
      `Error: ${error.error.message}. ${postgresMesage}`,
      'Dismiss',
      {}
    );
  }
}
