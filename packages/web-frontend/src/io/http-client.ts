export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export interface HttpClientOptions {
  baseUrl: string;
  getToken: () => string | null;
}

export class HttpClient {
  private readonly baseUrl: string;

  private readonly getToken: () => string | null;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.getToken = options.getToken;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  private async request<T>(
    path: string,
    options: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown }
  ): Promise<T> {
    const headers = new Headers({
      'Content-Type': 'application/json'
    });
    const token = this.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    if (response.status === 401) {
      throw new UnauthorizedError();
    }

    if (!response.ok) {
      let detail = '';
      try {
        const payload = (await response.json()) as { message?: unknown; error?: unknown };
        if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
          detail = payload.message.trim();
        } else if (payload.error && typeof payload.error === 'object') {
          const errorMessage = (payload.error as { message?: unknown }).message;
          if (typeof errorMessage === 'string' && errorMessage.trim().length > 0) {
            detail = errorMessage.trim();
          }
        }
      } catch {
        // ignore non-json error payloads
      }
      const base = `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(detail ? `${base} - ${detail}` : base);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}
