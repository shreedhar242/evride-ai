export function getApiError(error, fallback) {
  return error.response?.data?.message || fallback;
}
