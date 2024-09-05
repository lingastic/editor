import { Component } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { SchemaService } from '../utils/schema.service';
import { GlobService } from '../glob.service';
import { AccountService } from '../account/account.service';
import { LoginComponent } from '../account/login/login.component';
import { SignupComponent } from '../account/signup/signup.component';
import { MatDialog } from '@angular/material/dialog';
import * as version from '../version';

@Component({
  selector: 'app-side-nav',
  templateUrl: './side-nav.component.html',
  styleUrls: ['./side-nav.component.css'],
})
export class SideNavComponent {
  customMenu: Object;
  version = version.vars.version;
  released = version.vars.released;
  display = true;

  isHandset$: Observable<boolean> = this.breakpointObserver
    .observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  constructor(
    public schemaService: SchemaService,
    private breakpointObserver: BreakpointObserver,
    public accountService: AccountService,
    private globService: GlobService,
    public dialog: MatDialog
  ) {
    /*
     * TODO: should come from the db
    this.customMenu = [
      {
        name: 'Films',
        children: [
          { name: 'Films', route: 'resultSet/film' },
          { name: 'Actors', route: 'resultSet/actor' },
        ],
      },
      {
        name: 'Customers',
        children: [
          { name: 'Customers', route: 'resultSet/customer' },
          { name: 'Payment', route: 'resultSet/payment' },
          { name: 'Payment 2017 05', route: 'resultSet/payment_p2017_05' },
        ],
      },
    ];
    */
  }

  login() {
    const dialogRef = this.dialog.open(LoginComponent, {});
  }

  signup() {
    const dialogRef = this.dialog.open(SignupComponent, {});
  }

  setDisplay(display: boolean) {
    this.display = display;
  }
}
