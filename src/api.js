const BASE = import.meta.env.VITE_API_URL || "/api";

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
  async login(email, password) {
    const data = await request("POST", "/auth/login", { email, password });
    localStorage.setItem("castragestao:token", data.token);
    return data.user;
  },
  logout() {
    localStorage.removeItem("castragestao:token");
  },

  getRequests: () => request("GET", "/requests"),
  createRequest: (body) => request("POST", "/requests", body),
  consultRequestsByCredentials: (cpf, validationKey) => request("POST", "/requests/consult", { cpf, validationKey }),
  patchRequest: (id, patch) => request("PATCH", `/requests/${id}`, patch),
  deleteRequest: (id) => request("DELETE", `/requests/${id}`),

  lookupAnimalByMicrochip: (microchip) => request("POST", "/animals/lookup", { microchip }),
  consultAnimalByMicrochip: (body) => request("POST", "/animals/consult", body),
  createAnimalDeathRequest: (animalId, body) => request("POST", `/animals/${animalId}/death`, body),
  createAnimalTransferRequest: (animalId, body) => request("POST", `/animals/${animalId}/transfer`, body),
  createRequestDeathAction: (requestId, body) => request("POST", `/animals/requests/${requestId}/death`, body),
  createRequestTransferAction: (requestId, body) => request("POST", `/animals/requests/${requestId}/transfer`, body),

  getAdoptions: () => request("GET", "/adoptions"),
  consultAdoptionsByCredentials: (cpf, validationKey) => request("POST", "/adoptions/consult", { cpf, validationKey }),
  createAdoption: (body) => request("POST", "/adoptions", body),
  updateAdoption: (id, body) => request("PATCH", `/adoptions/${id}`, body),
  deleteAdoption: (id) => request("DELETE", `/adoptions/${id}`),
  registerInterest: (id, body) => request("POST", `/adoptions/${id}/interest`, body),
  getInterests: (id) => request("GET", `/adoptions/${id}/interests`),
  removeInterest: (id, index) => request("DELETE", `/adoptions/${id}/interest/${index}`),

  getAccessRequests: () => request("GET", "/access-requests"),
  createAccessRequest: (body) => request("POST", "/access-requests", body),
  reviewAccessRequest: (id, body) => request("PATCH", `/access-requests/${id}/review`, body),

  getSchedule: () => request("GET", "/schedule"),
  createScheduleDay: (body) => request("POST", "/schedule", body),
  updateScheduleDay: (id, body) => request("PATCH", `/schedule/${id}`, body),
  deleteScheduleDay: (id) => request("DELETE", `/schedule/${id}`),

  getConfig: (key) => request("GET", `/config/${key}`),
  setConfig: (key, value) => request("PUT", `/config/${key}`, value),

  validateDocument: (body) => request("POST", "/ai/validate", body),
};
