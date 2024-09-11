import { TFile, Vault } from 'obsidian';
import { google } from 'googleapis';
import { BloggerService } from './BloggerService';
import { OAuth2Client } from 'google-auth-library';

export class GoogleDriveService {
    private drive: any;
    private auth: OAuth2Client;
    private initialized: boolean = false;

    constructor(private vault: Vault, private bloggerService: BloggerService) {}

    async checkAuthStatus(): Promise<boolean> {
        if (!this.initialized) {
            await this.initializeDrive();
        }

        try {
            // 간단한 API 호출을 통해 인증 상태 확인
            await this.drive.files.list({
                pageSize: 1,
                fields: 'files(id, name)',
            });
            console.log('Google Drive authentication is valid');
            return true;
        } catch (error) {
            console.error('Google Drive authentication failed:', error);
            return false;
        }
    }

    private async initializeDrive() {
        console.log('Initializing Google Drive service');
        const accessToken = await this.bloggerService.getAccessToken();
        if (!accessToken) throw new Error('Failed to get access token');
        
        this.auth = new OAuth2Client();
        this.auth.setCredentials({ access_token: accessToken });
        
        this.drive = google.drive({ version: 'v3', auth: this.auth });
        this.initialized = true;
        console.log('Google Drive service initialized');
    }

    async refreshAuth() {
        console.log('Refreshing Google Drive authentication');
        const newAccessToken = await this.bloggerService.forceTokenRefresh();
        if (!newAccessToken) throw new Error('Failed to refresh access token');

        this.auth.setCredentials({ access_token: newAccessToken });
        this.drive = google.drive({ version: 'v3', auth: this.auth });
        console.log('Google Drive authentication refreshed');
    }

    async uploadFile(file: TFile): Promise<{ webViewLink: string, previewLink: string }> {
        if (!this.initialized) {
            await this.initializeDrive();
        }

        console.log('Starting file upload process');
        console.log('File info:', file);

        const buffer = await this.vault.readBinary(file);
        console.log('File buffer created');

        const requestBody = {
            name: file.name,
            parents: ['11n_uWFwnDpMY7Tum0R66GLyHyw1C-6hG'], // 여기에 업로드할 폴더 ID를 지정하세요
        };
        console.log('Request body:', requestBody);

        const media = {
            mimeType: file.extension === 'png' ? 'image/png' : 'image/jpeg',
            body: buffer,
        };
        console.log('Media object created');

        try {
            console.log('Attempting to create file on Google Drive');
            const response = await this.drive.files.create({
                requestBody: requestBody,
                media: media,
                fields: 'id,webViewLink',
            });
            console.log('File created successfully on Google Drive', response.data);

            const fileId = response.data.id;
            const webViewLink = response.data.webViewLink;
            const previewLink = `https://drive.google.com/uc?export=view&id=${fileId}`;

            return { webViewLink, previewLink };
        } catch (error) {
            console.error('Error uploading file to Google Drive:', error);
            if (error.response) {
                console.error('Error response:', JSON.stringify(error.response.data, null, 2));
            }
            throw error;
        }
    }
}