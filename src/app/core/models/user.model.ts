export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
