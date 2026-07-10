import { apiRequest } from "./http";

/** Fetch the internal school directory. Pass `q` to filter server-side by name substring. */
export async function getSchools(q) {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiRequest(`/schools${query}`);
}
