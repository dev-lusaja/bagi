const BASE_URL = 'http://192.168.0.172:8000';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const api = {
  get: async (url: string) => {
    const res = await fetch(BASE_URL + url, { headers: getHeaders() });
    if (!res.ok) {
        if (res.status === 401) {
            localStorage.removeItem('token');
            window.location.reload();
        }
        throw new Error(await res.text());
    }
    return res.json();
  },
  post: async (url: string, body: any) => {
    const res = await fetch(BASE_URL + url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  put: async (url: string, body: any) => {
    const res = await fetch(BASE_URL + url, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  delete: async (url: string) => {
    const res = await fetch(BASE_URL + url, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  login: async (username: string, password: string) => {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    const res = await fetch(BASE_URL + '/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    });
    if (!res.ok) throw new Error("Incorrect credentials");
    return res.json();
  },
  register: async (username: string, password: string) => {
    return api.post('/api/register', { username, password });
  }
};
