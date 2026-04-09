export interface GoogleDriveConfig {
    clientId: string;
    apiKey: string;
    scope: string;
    discoveryDocs: string[];
}

const DEFAULT_CONFIG: GoogleDriveConfig = {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
    scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile',
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
};

export class GoogleDriveAdapter {
    private tokenClient: any;
    private accessToken: string | null = null;
    private STORAGE_KEY = 'bagi_google_token';

    constructor() {}

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Load Google Identity Services (GSI)
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                const google = (window as any).google;
                this.tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: DEFAULT_CONFIG.clientId,
                    scope: DEFAULT_CONFIG.scope,
                    callback: (resp: any) => {
                        if (resp.error !== undefined) {
                            reject(resp);
                        }
                        this.accessToken = resp.access_token;
                        if (this.accessToken) {
                            localStorage.setItem(this.STORAGE_KEY, this.accessToken);
                            const gapi = (window as any).gapi;
                            if (gapi?.client) {
                                gapi.client.setToken({ access_token: this.accessToken });
                            }
                        }
                    },
                });
                
                // Load GAPI
                const gapiScript = document.createElement('script');
                gapiScript.src = 'https://apis.google.com/js/api.js';
                gapiScript.async = true;
                gapiScript.defer = true;
                gapiScript.onload = () => {
                   const gapi = (window as any).gapi;
                   gapi.load('client', async () => {
                       try {
                           await gapi.client.init({
                               apiKey: DEFAULT_CONFIG.apiKey,
                               discoveryDocs: DEFAULT_CONFIG.discoveryDocs,
                           });
                           resolve();
                       } catch (err) {
                           reject(err);
                       }
                   });
                };
                gapiScript.onerror = () => reject(new Error('Failed to load GAPI script'));
                document.body.appendChild(gapiScript);
            };
            script.onerror = () => reject(new Error('Failed to load GSI script'));
            document.body.appendChild(script);
        });
    }

    async login(): Promise<string> {
        return new Promise((resolve) => {
            this.tokenClient.callback = (resp: any) => {
                this.accessToken = resp.access_token;
                if (this.accessToken) {
                    localStorage.setItem(this.STORAGE_KEY, this.accessToken);
                    const gapi = (window as any).gapi;
                    if (gapi?.client) {
                        gapi.client.setToken({ access_token: this.accessToken });
                    }
                }
                resolve(this.accessToken!);
            };
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    }

    async tryRestoreSession(): Promise<{ name: string; picture: string } | null> {
        const savedToken = localStorage.getItem(this.STORAGE_KEY);
        if (!savedToken) return null;

        this.accessToken = savedToken;
        const gapi = (window as any).gapi;
        if (gapi?.client) {
            gapi.client.setToken({ access_token: this.accessToken });
        }
        const info = await this.getUserInfo();
        if (!info) {
            this.clearSession();
            return null;
        }
        return info;
    }

    clearSession() {
        this.accessToken = null;
        localStorage.removeItem(this.STORAGE_KEY);
    }

    async findFile(name: string, folderId: string | null = null): Promise<string | null> {
        const gapi = (window as any).gapi;
        let query = `name = '${name}' and trashed = false`;
        if (folderId) {
            query += ` and '${folderId}' in parents`;
        }
        try {
            const response = await gapi.client.drive.files.list({
                q: query,
                fields: 'files(id, name)',
                spaces: 'drive'
            });
            const files = response.result.files;
            return files && files.length > 0 ? (files[0].id ?? null) : null;
        } catch (err: any) {
            this.handleGapiError(err);
            throw err;
        }
    }

    async getOrCreateFolder(name: string): Promise<string> {
        const gapi = (window as any).gapi;
        try {
            // Search
            const searchResponse = await gapi.client.drive.files.list({
                q: `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
                fields: 'files(id, name)',
                spaces: 'drive'
            });
            const folders = searchResponse.result.files;
            if (folders && folders.length > 0) {
                console.log(`[Drive] Folder '${name}' found: ${folders[0].id}`);
                return folders[0].id;
            }

            // Create
            console.log(`[Drive] Creating folder '${name}'...`);
            const createResponse = await gapi.client.drive.files.create({
                resource: {
                    name: name,
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
            });
            return createResponse.result.id;
        } catch (err: any) {
            this.handleGapiError(err);
            throw err;
        }
    }

    async downloadFile(fileId: string): Promise<ArrayBuffer> {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: {
                Authorization: `Bearer ${this.accessToken}`
            }
        });
        return await response.arrayBuffer();
    }

    async uploadFile(name: string, content: Uint8Array, fileId: string | null = null, folderId: string | null = null): Promise<string> {
        const metadata: any = {
            name: name,
            mimeType: 'application/x-sqlite3',
        };
        
        if (folderId && !fileId) {
            metadata.parents = [folderId];
        }
        
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([content as any], { type: 'application/x-sqlite3' }));

        const url = fileId 
            ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        
        const method = fileId ? 'PATCH' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                Authorization: `Bearer ${this.accessToken}`
            },
            body: form
        });

        const result = await response.json();
        return result.id;
    }

    async getUserInfo(): Promise<{ name: string; picture: string } | null> {
        if (!this.accessToken) return null;
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${this.accessToken}` }
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new Error('AUTH_ERROR');
                }
                throw new Error(`User info failed with status ${response.status}`);
            }

            const data = await response.json();
            return {
                name: data.name,
                picture: data.picture
            };
        } catch (err: any) {
            console.error('[Drive] Error fetching user info:', err);
            if (err.message === 'AUTH_ERROR') throw err;
            return null;
        }
    }

    private handleGapiError(err: any) {
        const status = err?.status || err?.result?.error?.code;
        if (status === 401 || status === 403) {
            console.warn('[Drive] Authentication error detected:', status);
            throw new Error('AUTH_ERROR');
        }
    }
}
