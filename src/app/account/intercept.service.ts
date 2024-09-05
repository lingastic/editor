import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpInterceptor, HttpHandler, HttpRequest, HttpEvent, HttpResponse } from '@angular/common/http';
import { AccountService } from './account.service';
import { NGXLogger, NgxLoggerLevel } from 'ngx-logger';

/**
 * Intercept HTTP requests and inject headers
 * Once logged in, all requests will have the jwt authentication
 * token in them
 */

@Injectable({
  providedIn: 'root',
})
export class InterceptService implements HttpInterceptor {
  jwt = '';

  constructor(
    private accountService: AccountService,
    private logger: NGXLogger
  ) {}

  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    const userInfo = this.accountService.getUserInfo();
    if (!(userInfo && userInfo['jwt'])) {
      return next.handle(request); // not logged in don't inject
    }
    const jwt = userInfo['jwt'];
    let newHeaders = request.headers;
    const contentType = newHeaders.get('Content-type');
    this.logger.debug('Original contentType:' + contentType);
    this.logger.debug('in InterceptService ' + request.url);
    newHeaders = newHeaders.set('Authorization', `Bearer ${jwt}`);
    if (!contentType) {
      newHeaders = newHeaders.set('Content-type', `application/json`);
    }
    /*
     * https://developer.mozilla.org/en-US/docs/Web/API/FormData/Using_FormData_Objects
     *   When using FormData to submit POST requests using XMLHttpRequest or the Fetch_API with the
     *   multipart/form-data Content-Type (e.g. when uploading Files and Blobs to the server), do not
     *   explicitly set the Content-Type header on the request.
     */
    if (contentType === 'multipart/form-data') {
      newHeaders = newHeaders.delete('Content-type');
    }
    const newRequest = request.clone({ headers: newHeaders });
    return next.handle(newRequest);
  }
}
