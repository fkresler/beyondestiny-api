import fetch from 'node-fetch';
import { HttpClientConfig } from 'bungie-api-ts/http';
import { config } from './config';

export class HttpClientGenerator {
  apiKey: string;

  constructor() {
    this.apiKey = config.apiKey;
  }

  getClient() {
    return async (httpConfig: HttpClientConfig) => {
      try {
        const result = await fetch(httpConfig.url, {
          method: httpConfig.method,
          body: httpConfig.body ? JSON.stringify(httpConfig.body) : undefined,
          headers: { 'X-API-Key': this.apiKey, ...(httpConfig.body && { 'Content-Type': 'application/json' }) },
        });
        const data = await result.json();
        return data;
      } catch (e) {
        console.error('Fetching caught an error:', e);
        throw e;
      }
    };
  }
}

export default HttpClientGenerator;
