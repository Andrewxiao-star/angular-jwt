import {Injectable, Injector} from 'angular2/angular2';
import {Http, HTTP_PROVIDERS, Headers, BaseRequestOptions, Request, RequestOptions, RequestOptionsArgs, RequestMethods} from 'angular2/http';
let {Observable} = Rx;

/**
 * Sets up the authentication configuration.
 */

export class AuthConfig {
  
  config: any;
  headerName: string;
  headerPrefix: string;
  tokenName: string;
  jwt: string;

  constructor(config?:any) {
    this.config = config || {};
    this.headerName = this.config.headerName || 'Authorization';
    this.headerPrefix = this.config.headerPrefix || 'Bearer ';
    this.tokenName = this.config.tokenName || 'id_token';

    return {
      headerName: this.headerName,
      headerPrefix: this.headerPrefix,
      tokenName: this.tokenName
    }
  }

}

/**
 * Allows for explicit authenticated HTTP requests.
 */

@Injectable()
export class AuthHttp {

  private _config: AuthConfig;
  http: Http;

  constructor(config?:Object) {
    this._config = new AuthConfig(config);
    var injector = Injector.resolveAndCreate([HTTP_PROVIDERS]);
    this.http = injector.get(Http);

    var obs = new Rx.Observable()
  }

  request(method:RequestMethods, url:string, body?:string) {

    if(this.getJwt() === null || this.getJwt() === undefined || this.getJwt() === '') {
      throw 'No JWT Saved';
    }

    var authHeader = new Headers();
    authHeader.append(this._config.headerName, this._config.headerPrefix + this.getJwt());
    return this.http.request(new Request({
      method: method,
      url: url,
      body: body,
      headers: authHeader
    }));

  }

  getJwt() {
    return localStorage.getItem(this._config.tokenName);
  }

  get(url:string) {
    return this.request(RequestMethods.Get, url);
  }

  post(url:string, body:string) {
    return this.request(RequestMethods.Post, url, body);
  }

  put(url:string, body:string) {
    return this.request(RequestMethods.Put, url, body);
  }

  delete(url:string, body?:string) {
    return this.request(RequestMethods.Delete, url, body);
  }

  options(url:string, body?:string) {
    return this.request(RequestMethods.Options, url, body);
  }

  head(url:string, body?:string) {
    return this.request(RequestMethods.Head, url, body);
  }

  patch(url:string, body:string) {
    return this.request(RequestMethods.Patch, url, body);
  }
  
}

/**
 * Helper class to decode and find JWT expiration.
 */

export class JwtHelper {

  public urlBase64Decode(str:string) {
    var output = str.replace(/-/g, '+').replace(/_/g, '/');
    switch (output.length % 4) {
      case 0: { break; }
      case 2: { output += '=='; break; }
      case 3: { output += '='; break; }
      default: {
        throw 'Illegal base64url string!';
      }
    }
    return decodeURIComponent(escape(window.atob(output))); //polifyll https://github.com/davidchambers/Base64.js
  }

  public decodeToken(token:string) {
    var parts = token.split('.');

    if (parts.length !== 3) {
      throw new Error('JWT must have 3 parts');
    }

    var decoded = this.urlBase64Decode(parts[1]);
    if (!decoded) {
      throw new Error('Cannot decode the token');
    }

    return JSON.parse(decoded);
  }

  public getTokenExpirationDate(token:string) {
    var decoded: any;
    decoded = this.decodeToken(token);

    if(typeof decoded.exp === "undefined") {
      return null;
    }

    var date = new Date(0); // The 0 here is the key, which sets the date to the epoch
    date.setUTCSeconds(decoded.exp);

    return date;
  }

  public isTokenExpired(token:string, offsetSeconds:number) {
    var date = this.getTokenExpirationDate(token);
    offsetSeconds = offsetSeconds || 0;
    if (date === null) {
      return false;
    }

    // Token expired?
    return !(date.valueOf() > (new Date().valueOf() + (offsetSeconds * 1000)));
  }
}

/**
 * Checks for presence of token and that token hasn't expired.
 * For use with the @CanActivate router decorator and NgIf
 */

export function tokenNotExpired(tokenName?:string) {

  var tokenName = tokenName || 'id_token';
  var token = localStorage.getItem(tokenName);

  var jwtHelper = new JwtHelper();
  
  if(!token || jwtHelper.isTokenExpired(token)) {
    return false;
  }

  else {
    return true;
  }
}

export class Auth0Service {

  public token: string;
  private _storedToken: string;

  constructor(clientId:string, domain:string) {

    this.lock = new Auth0Lock(clientId, domain);
    
    this._storedToken = localStorage.getItem('id_token');

    if(this.storedToken) {
      this.token = new Observable(obs => {
        obs.next(this._storedToken)
      });
    }

    else {
      this.token = null;
    }

  }

  login() {
    let context = this;
    this.lock.show(function(err, profile, id_token) {

      if(err) {
        throw new Error(err);
      }

      localStorage.setItem('profile', JSON.stringify(profile));
      localStorage.setItem('id_token', id_token);

      context.token = new Observable(obs => {
        obs.next(id_token)
      });

    });
  }

  logout() {
    localStorage.removeItem('profile');
    localStorage.removeItem('id_token');
  }

}

