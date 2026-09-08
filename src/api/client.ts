import {
  ActivityCreate,
  ActivityRead,
  ActivityUpdate,
  ApiError,
  ApiErrorResponse,
  AreaCreate,
  AreaRead,
  AreaUpdate,
  ConsolidatedNode,
  TemporalView,
} from './types';

export interface ApiClientConfig {
  baseUrl?: string;
  userId?: string;
}

const DEFAULT_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const DEFAULT_USER_ID =
  import.meta.env.VITE_DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001';

export class ApiClient {
  private baseUrl: string;
  private userId: string;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.userId = config.userId || DEFAULT_USER_ID;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  public getUserId(): string {
    return this.userId;
  }

  public setUserId(id: string): void {
    this.userId = id;
  }

  /**
   * Generic HTTP request client handling headers, JSON serialization, and typed errors.
   */
  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const cleanBase = this.baseUrl.replace(/\/+$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${cleanBase}${cleanEndpoint}`;

    const headers = new Headers(options.headers || {});
    if (!headers.has('X-User-Id')) {
      headers.set('X-User-Id', this.userId);
    }
    if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorData: ApiErrorResponse;
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          detail: response.statusText || 'API request failed',
          code: response.status,
        };
      }
      throw new ApiError(response.status, errorData);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return (await response.json()) as T;
  }

  // --- Activities ---

  /**
   * Fetch consolidated activity nodes aggregated for the specified temporal view and focal date.
   */
  public async listActivities(
    view: TemporalView = 'day',
    date?: string
  ): Promise<ConsolidatedNode[]> {
    const params = new URLSearchParams();
    if (view) params.set('view', view);
    if (date) params.set('date', date);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request<ConsolidatedNode[]>(`/activities${queryString}`, {
      method: 'GET',
    });
  }

  /**
   * Create a new activity or accumulate hours into an existing same-day activity.
   */
  public async createActivity(payload: ActivityCreate): Promise<ActivityRead> {
    return this.request<ActivityRead>('/activities', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Update an existing activity by ID.
   */
  public async updateActivity(id: string, payload: ActivityUpdate): Promise<ActivityRead> {
    return this.request<ActivityRead>(`/activities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Delete an activity by ID.
   */
  public async deleteActivity(id: string): Promise<void> {
    await this.request<void>(`/activities/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Life Areas ---

  /**
   * List all life areas belonging to the authenticated user.
   */
  public async listAreas(): Promise<AreaRead[]> {
    return this.request<AreaRead[]>('/areas', {
      method: 'GET',
    });
  }

  /**
   * Create a new life area.
   */
  public async createArea(payload: AreaCreate): Promise<AreaRead> {
    return this.request<AreaRead>('/areas', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Update an existing life area by ID.
   */
  public async updateArea(id: string, payload: AreaUpdate): Promise<AreaRead> {
    return this.request<AreaRead>(`/areas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Delete a life area by ID.
   */
  public async deleteArea(id: string): Promise<void> {
    await this.request<void>(`/areas/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Health ---

  /**
   * Check backend application and database health.
   */
  public async healthCheck(): Promise<{ status: string; db: boolean }> {
    return this.request<{ status: string; db: boolean }>('/health', {
      method: 'GET',
    });
  }
}

// Default singleton instance
export const apiClient = new ApiClient();

// Convenient direct function exports
export const listActivities = (view?: TemporalView, date?: string) =>
  apiClient.listActivities(view, date);
export const createActivity = (payload: ActivityCreate) => apiClient.createActivity(payload);
export const updateActivity = (id: string, payload: ActivityUpdate) =>
  apiClient.updateActivity(id, payload);
export const deleteActivity = (id: string) => apiClient.deleteActivity(id);

export const listAreas = () => apiClient.listAreas();
export const createArea = (payload: AreaCreate) => apiClient.createArea(payload);
export const updateArea = (id: string, payload: AreaUpdate) => apiClient.updateArea(id, payload);
export const deleteArea = (id: string) => apiClient.deleteArea(id);

export const healthCheck = () => apiClient.healthCheck();
