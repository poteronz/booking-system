// API helper — обёртка над fetch
const API = {
  async request(method, url, body = null) {
    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include", // cookies
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`/api${url}`, opts);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Ошибка сервера");
    }
    return data;
  },

  get(url) { return this.request("GET", url); },
  post(url, body) { return this.request("POST", url, body); },
  delete(url) { return this.request("DELETE", url); },
};
