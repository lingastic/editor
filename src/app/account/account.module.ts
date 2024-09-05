import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from './login/login.component';
import { FormlyModule } from '@ngx-formly/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormlyMatDatepickerModule } from '@ngx-formly/material/datepicker';
import { FormlyMaterialModule } from '@ngx-formly/material';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { InterceptService } from './intercept.service';
import { SignupComponent } from './signup/signup.component';
// import { SettingsComponent } from './settings/settings.component';

@NgModule({
  declarations: [
    LoginComponent,
    SignupComponent,
    // SettingsComponent
  ],
  exports: [LoginComponent],
  imports: [
    ReactiveFormsModule,
    CommonModule,
    FormlyMaterialModule,
    FormlyModule.forRoot({
      types: [],
    }),
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: InterceptService,
      multi: true,
    },
  ],
})
export class AccountModule {}
