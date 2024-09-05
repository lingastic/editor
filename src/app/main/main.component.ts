import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { GlobService } from '../glob.service';
import { SchemaService } from '../utils/schema.service';
import { HttpClient } from '@angular/common/http';
import { AccountService } from '../account/account.service';
import { NGXLogger } from 'ngx-logger';
import { MiscService } from '../utils/misc.service';

/**
 * Main page of the app, root path
 */

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css'],
})
export class MainComponent implements OnInit {
  glob;
  tables;

  // prettier-ignore
  constructor(
    private globService: GlobService,
    private http: HttpClient,
    public schemaService: SchemaService,
    private accountService: AccountService,
    private location: Location,
    private miscService: MiscService,
    private logger: NGXLogger
  ) {
    const app = this.globService.api['app'];
    if (app && this.schemaService.currApp) {
      const homepage = this.schemaService.currApp.homepage;
      // We need to prepend the '/page/' to the homepage. This is because 
      // it's a "page" and pages are prefixed with '/page/' in the URL.
      this.miscService.changeLocation(`/page/${homepage}`);
    }
    const currPath = this.location.path();
    if (currPath.startsWith('/logout')) {
      this.logout();
    }
  }

  ngOnInit() {
    this.glob = this.globService;
  }

  logout() {
    this.accountService.removeUserInfo();
    this.schemaService.parseSchema(); // Reload schema info now that we're not logged int
    window.location.href = '/'; // Force reload to refresh display of schema
  }
}
