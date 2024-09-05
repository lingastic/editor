import { NgModule, APP_INITIALIZER, SecurityContext } from '@angular/core';
import { InitService } from './utils/init.service';

import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTreeModule } from '@angular/material/tree';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { BrowserModule } from '@angular/platform-browser';
import { CreateDialogComponent } from './result-set/create-dialog-component';
import { DeleteDialogComponent } from './result-set/delete-dialog-component';
import { ViewDialogComponent } from './result-set/view-dialog-component';
import { FormlyModule } from '@ngx-formly/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormlyMatDatepickerModule } from '@ngx-formly/material/datepicker';
import { FormlyMaterialModule } from '@ngx-formly/material';
import { FormlyMatToggleModule } from '@ngx-formly/material/toggle';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { LayoutModule } from '@angular/cdk/layout';
import { LoggerModule, NgxLoggerLevel } from 'ngx-logger';
import { MainComponent } from './main/main.component';
import { ResultSetComponent } from './result-set/result-set.component';
import { SideNavComponent } from './side-nav/side-nav.component';
import { AutocompleteTypeComponent } from './result-set/autocomplete-type.component';
import { FileComponent } from './result-set/file.component';
import { AccountModule } from './account/account.module';
import { BaseChartDirective } from 'ng2-charts';
import { ChartComponent } from './result-set/chart/chart.component';
import { PageEditComponent } from './page/edit';
import { PageViewComponent } from './page/view';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { MarkdownModule } from 'ngx-markdown';
import { TreeComponent } from './widgets/tree/tree.component';

export function initApp(initService: InitService) {
  return () => initService.initApp();
}

@NgModule({ declarations: [
        AppComponent,
        SideNavComponent,
        MainComponent,
        ResultSetComponent,
        CreateDialogComponent,
        DeleteDialogComponent,
        ViewDialogComponent,
        AutocompleteTypeComponent,
        FileComponent,
        PageEditComponent,
        PageViewComponent,
        ChartComponent,
        TreeComponent,
    ],
    exports: [ResultSetComponent, ChartComponent],
    bootstrap: [AppComponent], imports: [BrowserModule,
        AppRoutingModule,
        BrowserAnimationsModule,
        FormsModule,
        ReactiveFormsModule,
        LayoutModule,
        MatToolbarModule,
        MatTooltipModule,
        MatSelectModule,
        MatProgressSpinnerModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSidenavModule,
        MatSnackBarModule,
        MatIconModule,
        MatListModule,
        MatTableModule,
        MatTreeModule,
        MatPaginatorModule,
        MatSortModule,
        MatGridListModule,
        MatAutocompleteModule,
        MatCardModule,
        MatDialogModule,
        MatMenuModule,
        ReactiveFormsModule,
        FormlyMaterialModule,
        MonacoEditorModule.forRoot(),
        FormlyModule.forRoot({
            types: [
                {
                    name: 'autocomplete',
                    component: AutocompleteTypeComponent,
                    wrappers: ['form-field'],
                },
                // { name: 'file', component: FileComponent, wrappers: ['form-field'] },
            ],
            validationMessages: [
                { name: 'required', message: 'This field is required' },
            ],
        }),
        MarkdownModule.forRoot({
            sanitize: SecurityContext.NONE,
        }),
        FormlyMatToggleModule,
        MatNativeDateModule,
        FormlyMatDatepickerModule,
        AccountModule,
        LoggerModule.forRoot({ level: NgxLoggerLevel.INFO }),
        BaseChartDirective], providers: [
        InitService,
        {
            provide: APP_INITIALIZER,
            useFactory: initApp,
            deps: [InitService],
            multi: true,
        },
        provideHttpClient(withInterceptorsFromDi()),
    ] })
export class AppModule {}
