import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { MainComponent } from './main/main.component';
import { LoginComponent } from './account/login/login.component';
import { SignupComponent } from './account/signup/signup.component';
import { ResultSetComponent } from './result-set/result-set.component';
import { PageEditComponent } from './page/edit';
import { PageViewComponent } from './page/view';
import { ChartComponent } from './result-set/chart/chart.component';

/*
 * Routing module.
 */

/*
 * Special matcher for pages which are the default in the app
 * and we want to be abel to pass a full path as params
 * This way we can view /page/cdbfly/tutorial/links and everything
 * after /page is the page name
 */
function pageMatcher(segments) {
  const op = segments[0];
  if (op && op.path === 'page') {
    return { consumed: segments };
  } else {
    return null;
  }
}

/*
 * Special matcher for pagesedit so we can pass a path
 * This way we can edit /pageedit/cdbfly/tutorial/links and everything
 * after /pageedit is the page name
 */
function pageEditMatcher(segments) {
  const op = segments[0];
  if (op && op.path === 'pageedit') {
    return { consumed: segments };
  } else {
    return null;
  }
}
const routes: Routes = [
  { path: 'resultSet/:id', component: ResultSetComponent },
  { path: '', component: MainComponent },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'logout', component: MainComponent },
  { path: 'pageedit/:id', component: PageEditComponent },
  { path: 'pageedit', component: PageEditComponent },
  { path: 'chart/:id', component: ChartComponent },
  { matcher: pageEditMatcher, component: PageEditComponent },
  { matcher: pageMatcher, component: PageViewComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
