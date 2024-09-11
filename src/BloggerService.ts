import { Notice, Vault, App, Modal } from 'obsidian';
import { BloggerPublishSettings } from './SettingsManager';
import * as http from 'http';
import { AddressInfo } from 'net';
import { Setting } from 'obsidian';

export class BloggerService {
    private settings: BloggerPublishSettings;
    private vault: Vault;
    private app: App;

    constructor(settings: BloggerPublishSettings, vault: Vault, app: App) {
        this.settings = settings;
        this.vault = vault;
        this.app = app;
    }

    async getTokens(): Promise<{ access_token: string | null, refresh_token: string | null }> {
        const tokenPath = this.getTokenPath();
        try {
            const tokenContent = await this.vault.adapter.read(tokenPath);
            const token = JSON.parse(tokenContent);
            
            if (token.expiry_date && token.expiry_date > Date.now()) {
                console.log('Using existing valid tokens');
                return { 
                    access_token: token.access_token, 
                    refresh_token: token.refresh_token 
                };
            } else if (token.refresh_token) {
                console.log('Refreshing access token');
                const newAccessToken = await this.refreshAccessToken(token.refresh_token);
                return { 
                    access_token: newAccessToken, 
                    refresh_token: token.refresh_token 
                };
            }
        } catch (error) {
            console.log('No existing token found or token is invalid:', error);
        }
        
        console.log('Requesting new tokens');
        const newAccessToken = await this.requestAccessToken();
        // requestAccessToken이 단일 문자열만 반환하므로, 여기서는 refresh_token을 null로 설정합니다.
        return {
            access_token: newAccessToken,
            refresh_token: null
        };
    }

    async getAccessToken(): Promise<string | null> {
        const tokenPath = this.getTokenPath();
        try {
            const tokenContent = await this.vault.adapter.read(tokenPath);
            const token = JSON.parse(tokenContent);
            console.log('Current token info:', token);
            
            // 토큰이 만료되었는지 확인
            if (token.expiry_date && token.expiry_date > Date.now()) {
                console.log('Using existing valid access token');
                return token.access_token;
            } else if (token.refresh_token) {
                // 리프레시 토큰이 있다면 새 액세스 토큰을 요청
                console.log('Refreshing access token');
                return await this.refreshAccessToken(token.refresh_token);
            }
        } catch (error) {
            console.log('No existing token found or token is invalid:', error);
        }
        
        console.log('Requesting new access token');
        return await this.requestAccessToken();
    }

    async requestAccessToken(): Promise<string | null> {
        try {
            const clientSecretContent = await this.vault.adapter.read(this.settings.oauthJsonPath);
            const clientSecret = JSON.parse(clientSecretContent);
            const { client_id, client_secret, redirect_uris } = clientSecret.installed;

            const server = await this.startLocalServer();
            const port = (server.address() as AddressInfo).port;
            const redirectUri = `http://localhost:${port}`;

            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${client_id}&` +
                `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                `response_type=code&` +
                `scope=${encodeURIComponent('https://www.googleapis.com/auth/blogger https://www.googleapis.com/auth/drive.file')}&` +
                `access_type=offline&` +
                `prompt=consent`;

            window.open(authUrl, '_blank');

            const authCode = await this.waitForAuthCode(server);
            server.close();

            if (!authCode) return null;

            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code: authCode,
                    client_id: client_id,
                    client_secret: client_secret,
                    redirect_uri: redirectUri,
                    grant_type: 'authorization_code'
                })
            });

            const tokenData = await tokenResponse.json();
            if (tokenData.access_token) {
                await this.vault.adapter.write(this.getTokenPath(), JSON.stringify(tokenData));
                await this.updateAccessTokenPath(this.getTokenPath());
                return tokenData.access_token;
            }
        } catch (error) {
            console.error('Error in requestAccessToken:', error);
        }

        return null;
    }

    private async promptForAuthCode(): Promise<string | null> {
        return new Promise((resolve) => {
            const modal = new Modal(this.app);
            modal.titleEl.setText('Enter Authorization Code');
            modal.contentEl.createEl('p', {text: 'Please enter the authorization code from the Google authentication page:'});

            let authCode = '';

            new Setting(modal.contentEl)
                .setName('Authorization Code')
                .addText((text) => 
                    text.onChange((value) => {
                        authCode = value;
                    })
                );

            new Setting(modal.contentEl)
                .addButton((btn) => 
                    btn
                        .setButtonText('Submit')
                        .setCta()
                        .onClick(() => {
                            modal.close();
                            resolve(authCode);
                        })
                );

            modal.open();
        });
    }

    private startLocalServer(): Promise<http.Server> {
        return new Promise((resolve) => {
            const server = http.createServer((req, res) => {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('Authentication successful! You can close this window now.');
            });
            server.listen(0, 'localhost', () => resolve(server));
        });
    }

    private waitForAuthCode(server: http.Server): Promise<string | null> {
        return new Promise((resolve) => {
            server.on('request', (req, res) => {
                const url = new URL(req.url!, `http://${req.headers.host}`);
                const code = url.searchParams.get('code');
                if (code) {
                    resolve(code);
                } else {
                    resolve(null);
                }
            });
        });
    }

    getTokenPath(): string {
        if (!this.settings.accessTokenPath) {
            this.settings.accessTokenPath = this.settings.oauthJsonPath.replace('.json', '_token.json');
            // 설정을 저장하는 로직이 필요합니다. 예를 들어:
            // this.saveSettings();
        }
        return this.settings.accessTokenPath;
    }

    private async refreshAccessToken(refreshToken: string): Promise<string | null> {
        try {
            const clientSecretContent = await this.vault.adapter.read(this.settings.oauthJsonPath);
            const clientSecret = JSON.parse(clientSecretContent);
            const { client_id, client_secret } = clientSecret.installed;

            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: client_id,
                    client_secret: client_secret,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token'
                })
            });

            const tokenData = await response.json();
            if (tokenData.access_token) {
                // 새 액세스 토큰 저장
                tokenData.expiry_date = Date.now() + (tokenData.expires_in * 1000);
                await this.vault.adapter.write(this.getTokenPath(), JSON.stringify(tokenData));
                return tokenData.access_token;
            }
        } catch (error) {
            console.error('Error refreshing access token:', error);
        }
        return null;
    }

    private async updateAccessTokenPath(tokenPath: string) {
        this.settings.accessTokenPath = tokenPath;
        // SettingsManager의 saveSettings 메서드를 호출하는 방법이 필요합니다.
        // 예를 들어, 이벤트를 발생시키거나 콜백 함수를 사용할 수 있습니다.
        // 여기서는 예시로 이벤트를 사용하겠습니다.
        this.app.workspace.trigger('blogger-publish:settings-updated');
    }

    async forceTokenRefresh() {
        const tokenPath = this.getTokenPath();
        await this.vault.adapter.remove(tokenPath);
        return await this.requestAccessToken();
    }
}