export {};

declare module "axios" {
  interface AxiosRequestConfig {
    skipAuth?: boolean;
  }
}
