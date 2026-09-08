/**
 * TypeScript types aligned 1:1 with FastAPI/Pydantic schemas:
 * - backend/app/schemas/area.py
 * - backend/app/schemas/activity.py
 */

export type TemporalView = 'day' | 'week' | 'month' | 'global';

export interface AreaRead {
  id: string;
  user_id: string;
  name: string;
  color: string;
  visible: boolean;
  created_at: string;
}

export interface AreaCreate {
  name: string;
  color: string;
  visible?: boolean;
}

export interface AreaUpdate {
  name?: string;
  color?: string;
  visible?: boolean;
}

export interface ActivityRead {
  id: string;
  user_id: string;
  name: string;
  name_normalized: string;
  hours: number;
  temperature: number;
  date: string;
  notes?: string | null;
  created_at: string;
  areas: AreaRead[];
  area_ids: string[];
}

export interface ActivityCreate {
  name: string;
  hours: number;
  temperature: number;
  date: string;
  notes?: string | null;
  area_ids?: string[];
}

export interface ActivityUpdate {
  name?: string;
  hours?: number;
  temperature?: number;
  date?: string;
  notes?: string | null;
  area_ids?: string[];
}

export interface ConsolidatedNode {
  id?: string;
  activity_ids?: string[];
  name: string;
  name_normalized: string;
  total_hours: number;
  weighted_temperature: number;
  area_ids: string[];
  entry_count: number;
}

export interface ApiValidationErrorItem {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export type ApiErrorDetail = string | ApiValidationErrorItem[];

export interface ApiErrorResponse {
  detail: ApiErrorDetail;
  code?: number;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly data: ApiErrorResponse;

  constructor(status: number, data: ApiErrorResponse) {
    const message = typeof data.detail === 'string'
      ? data.detail
      : Array.isArray(data.detail)
        ? data.detail.map((e) => `${e.loc.join('.')}: ${e.msg}`).join(', ')
        : 'API request failed';
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
