import { Injectable } from '@angular/core';
import { NGXLogger } from 'ngx-logger';

const USER_INFO = 'user_info';

@Injectable({
  providedIn: 'root',
})
export class AccountService {
  credentials: object = {};

  constructor(
    private logger: NGXLogger,
  ) {}

  async init() {
    const stringCredentials = localStorage.getItem(USER_INFO);
    this.credentials =  stringCredentials ? JSON.parse(stringCredentials) : null;
  }

  setUserInfo(userInfo: object) {
    localStorage.setItem(USER_INFO, JSON.stringify(userInfo));
    this.logger.info('stored userInfo', this.credentials);
  }

  getUserInfo() {
    return this.credentials;
  }

  removeUserInfo() {
    localStorage.removeItem(USER_INFO);
    this.credentials = {};
  }
}
