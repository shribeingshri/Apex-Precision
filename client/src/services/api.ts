export const API_BASE = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') || '';

export async function parseJsonSafe(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      'Backend API server is not connected (received HTML instead of JSON). Deploy the backend server + PostgreSQL or set VITE_API_URL.'
    );
  }
  return response.json();
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('mfg_erp_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = 'An error occurred during API request.';
    try {
      const errorData = await parseJsonSafe(response);
      errorMsg = errorData.message || errorData.error || errorMsg;
    } catch (e: any) {
      if (e?.message) errorMsg = e.message;
    }
    throw new Error(errorMsg);
  }

  return parseJsonSafe(response);
}
