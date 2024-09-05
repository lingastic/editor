import { Injectable, isDevMode, NgZone } from '@angular/core';
import { AccountService } from '../account/account.service';
import { InterceptService } from '../account/intercept.service';
import { SchemaService } from '../utils/schema.service';
import { NGXLogger, NgxLoggerLevel } from 'ngx-logger';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { GlobService } from '../glob.service';
import { Router } from '@angular/router';
import { DataService } from '../result-set/data.service';

@Injectable({
  providedIn: 'root',
})
export class InitService {
  glob;
  constructor(
    public schemaService: SchemaService,
    private http: HttpClient,
    private zone: NgZone,
    private router: Router,
    private accountService: AccountService,
    private interceptService: InterceptService,
    private globService: GlobService,
    private dataService: DataService,
    private logger: NGXLogger
  ) {
    this.glob = globService;
    for (let server of this.glob.devApi.servers) {
      if (window.location.hostname.match(server.regex)) {
        this.glob.api = { url: server.url, app: server.app };
        break;
      }
    }
  }

  /**
   * Called to initialize the app before anything else happens. Started by the code in
   * app.module.ts: APP_INITIALIZER
   */
  async initApp() {
    // First get the credentials, if any, from localForage
    await this.accountService.init();
    //
    await this.schemaService.parseSchema();
    const that = this;
    // Create a window.cdbfly variable that available simply as "cdbfly" from javascript
    window['cdbfly'] = {
      navZone: this.zone,
      go: link => this.navigate(link),
      relations: this.schemaService.getRelations(),
      tabs: this.schemaService.tabs,
      views: this.schemaService.views,
      server: this.glob.api.url,
      navigate: function(href) {
        that.zone.run(() => {
          that.navigate(href);
        });
      },
      request: async function(path, text, resolve) {
        await that.zone.run(async () => {
          const res = await that.dataService.request(path, text);
          resolve(res);
        });
      },
    };
  }

  /*
   * Provide a way to navigate to a url without refreshing the page at run time
   */
  navigate(link) {
    if (link) {
      this.router.navigate([link]);
    }
  }
}
