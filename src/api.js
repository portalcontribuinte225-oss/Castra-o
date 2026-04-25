const BASE = import.meta.env.VITE_API_URL || "http://localhost:3002/api";

function getToken() {
  return localStorage.getItem("castragestao:token");
}

function headers(json = true) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  const token = getToken();
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Auth
  async login(email, password) {
    const data = await request("POST", "/auth/login", { email, password });
    localStorage.setItem("castragestao:token", data.token);
    return data.user;
  },
  async register(userData) {
    const data = await request("POST", "/auth/register", {
      name: userData.tutor,
      email: userData.email,
      password: userData.password,
      role: "tutor",
    });
    return data;
  },
  logout() {
    localStorage.removeItem("castragestao:token");
  },

  // Requests
  getRequests: () => request("GET", "/requests"),
  createRequest: (body) => request("POST", "/requests", body),
  updateRequestStatus: (id, status, notes) => request("PATCH", `/requests/${id}/status`, { status, notes }),
  patchRequest: (id, patch) => request("PATCH", `/requests/${id}`, patch),
  deleteRequest: (id) => request("DELETE", `/requests/${id}`),

  // Adoptions
  getAdoptions: () => request("GET", "/adoptions"),
  createAdoption: (body) => request("POST", "/adoptions", body),
  updateAdoption: (id, body) => request("PATCH", `/adoptions/${id}`, body),
  deleteAdoption: (id) => request("DELETE", `/adoptions/${id}`),

  // Schedule
  getSchedule: () => request("GET", "/schedule"),
  createScheduleDay: (body) => request("POST", "/schedule", body),
  updateScheduleDay: (id, body) => request("PATCH", `/schedule/${id}`, body),
  deleteScheduleDay: (id) => request("DELETE", `/schedule/${id}`),

  // Config
  getConfig: (key) => request("GET", `/config/${key}`),
  setConfig: (key, value) => request("PUT", `/config/${key}`, value),
};
