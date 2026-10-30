import { ApiConfigurationError, ApiError } from './errors';

export type RequestOptions = Omit<RequestInit, 'body' | 'method'> & {
  body?: unknown;
};

/** Abstraction the services depend on, so the transport can be swapped or mocked. */
export interface HttpClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(path: string, options?: RequestOptions): Promise<T>;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** HttpClient implementation on top of the browser fetch API, sending and receiving JSON. */
export class FetchHttpClient implements HttpClient {
  private readonly baseUrl: string | null;
  private readonly fetchFn: FetchFn;

  constructor(baseUrl: string | null, fetchFn: FetchFn = (input, init) => fetch(input, init)) {
    this.baseUrl = baseUrl;
    this.fetchFn = fetchFn;
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, { ...options, body });
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  private async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const { body, headers, ...rest } = options;

    const response = await this.fetchFn(this.buildUrl(path), {
      ...rest,
      method,
      headers: this.buildHeaders(headers, body !== undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = await FetchHttpClient.parseBody(response);
    if (!response.ok) {
      throw new ApiError(`Request failed with status ${response.status}`, response.status, data);
    }
    return data as T;
  }

  private buildUrl(path: string): string {
    if (this.baseUrl === null) {
      throw new ApiConfigurationError();
    }
    return `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
  }

  private buildHeaders(headers: HeadersInit | undefined, hasBody: boolean): Headers {
    // Caller-provided values take precedence over the JSON defaults.
    const result = new Headers(headers);
    if (!result.has('Accept')) {
      result.set('Accept', 'application/json');
    }
    if (hasBody && !result.has('Content-Type')) {
      result.set('Content-Type', 'application/json');
    }
    return result;
  }

  private static async parseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
      return undefined;
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}
