import { API_URL } from "../config/apiUrl.js";

export function resolveApiAssetUrl(value) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return `${API_URL}${value.startsWith("/") ? value : `/${value}`}`;
}
