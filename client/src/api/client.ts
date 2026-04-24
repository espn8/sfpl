import axios from "axios";
import { recordServerTiming } from "../lib/perf";

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

apiClient.interceptors.response.use((response) => {
  const header = response.headers?.["server-timing"] ?? response.headers?.["Server-Timing"];
  const url = response.config?.url;
  if (typeof url === "string" && typeof header === "string") {
    recordServerTiming(url, header);
  }
  return response;
});
