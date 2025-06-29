export interface ApiResponseFoundCode {
  message: string[];
  scan_id?: number;
}

export interface UserLogin {
    username: string
    password: string
}

export interface UserDetails {
    username: string
}

export interface ImageData {
    image: string
}

export type Record = [number, string, string]; // [id, timestamp, data]

export interface RecordResponse {
    record: Record[];
}
