import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "";

const headers: Record<string, string> = {};

const devWhitelistToken = import.meta.env.VITE_DEV_WHITELIST_TOKEN;
if (devWhitelistToken) {
  headers["X-Dev-Whitelist-Token"] = devWhitelistToken;
}

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers,
});
