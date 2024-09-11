import { Plugin, PluginSettingTab, Notice, EventRef, Events, TFile } from 'obsidian';
import { GetActiveFileContent } from './src/GetActiveFileContent';
import { SettingsManager } from './src/SettingsManager';
import { HtmlConverter } from './src/HtmlConverter';
import { BloggerService } from './src/BloggerService';
import { FrontmatterManager } from './src/FrontmatterManager';
import { format } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { GoogleDriveService } from './src/GoogleDriveService';
import { ImgurService } from './src/ImgurService';

export default class BloggerPublishPlugin extends Plugin {
    private getActiveFileContent: GetActiveFileContent;
    private htmlConverter: HtmlConverter;
    settings: SettingsManager;
    private bloggerService: BloggerService;
    private settingTab: PluginSettingTab;
    private settingsUpdateEvent: Events;
    private settingsUpdateRef: EventRef | null = null;
    private frontmatterManager: FrontmatterManager;
    private googleDriveService: GoogleDriveService;
    private imgurService: ImgurService;

    async onload() {
        this.settings = new SettingsManager(this.app, this);
        await this.settings.loadSettings();
        console.log('Settings loaded:', this.settings.settings);

        this.addSettingTab(this.settings);

        this.imgurService = new ImgurService(this.app.vault, this.settings.settings.imgurClientId);
        this.getActiveFileContent = new GetActiveFileContent(this.app, this.settings, this.imgurService);
        this.htmlConverter = new HtmlConverter(this.settings);
        this.bloggerService = new BloggerService(this.settings.settings, this.app.vault, this.app);
        this.frontmatterManager = new FrontmatterManager(this.app.vault);
        this.googleDriveService = new GoogleDriveService(this.app.vault, this.bloggerService);

        // 기존 리본 아이콘
        this.addRibbonIcon('info', 'Get Active File Info', (evt: MouseEvent) => {
            this.getActiveFileInfo();
        });

        // 새로운 리본 아이콘 추가
        this.addRibbonIcon('upload', 'Publish to Blogger', (evt: MouseEvent) => {
            this.publishToBlogger();
        });

        // 기존 명령어 추가
        this.addCommand({
            id: 'get-active-file-info',
            name: 'Get Active File Info',
            callback: () => this.getActiveFileInfo()
        });

        // 새로운 명령어 추가
        this.addCommand({
            id: 'publish-to-blogger',
            name: 'Publish to Blogger',
            callback: () => this.publishToBlogger()
        });

        // 새로운 명령어 추가
        this.addCommand({
            id: 'get-google-api-access',
            name: 'Get Google API Access',
            callback: () => this.getGoogleApiAccess()
        });

        // 새로운 명령어 가
        this.addCommand({
            id: 'show-blogger-info',
            name: 'Show Blogger Info',
            callback: () => this.showBloggerInfo()
        });

        // 새로운 명령어 추가
        this.addCommand({
            id: 'upload-image-to-google-drive',
            name: 'Upload Image to Google Drive',
            callback: () => this.uploadImageToGoogleDrive()
        });

        // 새로운 명령어 추가
        this.addCommand({
            id: 'upload-image-to-imgur',
            name: 'Upload Image to Imgur',
            callback: () => this.uploadImageToImgur()
        });

        // 설정 변경 시 호출될 메서드 등록
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.onSettingsChanged();
            })
        );

        // Google Drive 승인 상태 체크 명령어 추가
        this.addCommand({
            id: 'check-google-drive-auth',
            name: 'Check Google Drive Authorization',
            callback: () => this.checkGoogleDriveAuth()
        });
    }

    async onSettingsChanged() {
        await this.settings.loadSettings();
        if (this.settingTab instanceof SettingsManager) {
            this.settingTab.display();
        }
    }

    async getActiveFileInfo() {
        const fileName = this.getActiveFileContent.getFileName();
        const content = await this.getActiveFileContent.getContent();

        if (fileName && content) {
            const htmlContent = await this.htmlConverter.convertObsidianToHtml(content);
            new Notice(`File: ${fileName}\nContent preview: ${content.substring(0, 100)}...`);
            console.log(`Active file name: ${fileName}`);
            console.log('Original content:');
            console.log(content);
            console.log('HTML content:');
            console.log(htmlContent);
        } else {
            new Notice('No active file or unable to read content');
        }
    }

    async publishToBlogger() {
        try {
            const blogId = this.settings.settings.blogId;
            const accessToken = await this.bloggerService.getAccessToken();

            if (!blogId || !accessToken) {
                new Notice('Blog ID or Access Token is missing. Please check your settings.');
                return;
            }

            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice('No active file');
                return;
            }

            const fileName = this.getActiveFileContent.getFileName();
            const content = await this.getActiveFileContent.getContent();

            if (!content) {
                new Notice('Unable to read content');
                return;
            }

            const htmlContent = await this.htmlConverter.convertObsidianToHtml(content);

            // frontmatter에서 기존 PostID를 확인
            const frontmatter = await this.frontmatterManager.getFrontmatter(activeFile);
            const existingPostId = frontmatter?.PostID;

            let result;
            if (existingPostId && fileName) {
                // 기존 게시물 업데이트
                result = await this.updateBloggerPost(blogId, existingPostId, fileName, htmlContent, accessToken);
                new Notice('Existing post has been updated successfully.');
            } else if (fileName) {
                // 새 게시물 생성
                result = await this.createBloggerPost(blogId, fileName, htmlContent, accessToken);
                new Notice('New post has been created successfully.');
            } else {
                new Notice('Unable to publish: File name is missing');
                return;
            }

            const dateFormat = this.settings.settings.dateFormat;
            const dateLanguage = this.settings.settings.dateLanguage;
            const publishedDate = formatDate(result.published, dateFormat, dateLanguage);
            const updatedDate = formatDate(result.updated, dateFormat, dateLanguage);

            console.log('Extracted post information:');
            console.log(`URL: ${result.url}`);
            console.log(`ID: ${result.id}`);
            console.log(`Published: ${publishedDate}`);
            console.log(`Updated: ${updatedDate}`);

            // frontmatter 업데이트
            if (activeFile) {
                await this.frontmatterManager.updateFrontmatter(activeFile, {
                    id: result.id,
                    url: result.url,
                    publishedDate,
                    updatedDate
                });
                new Notice('Frontmatter has been updated.');
            } else {
                new Notice('No active file to update frontmatter.');
            }

            new Notice('New post has been created successfully.');

            // Check if the "Open Browser After Publish" option is enabled
            if (this.settings.settings.openBrowserAfterPublish) {
                // Open the published post URL in the default browser
                if (result.url) {
                    const { shell } = require('electron');
                    shell.openExternal(result.url);
                    new Notice('Opening published post in browser.');
                } else {
                    new Notice('Unable to open post: URL not available.');
                }
            }

        } catch (error) {
            console.error('Error in publishToBlogger:', error);
            new Notice(`Error: ${error.message}`);
        }
    }

    async createBloggerPost(blogId: string, title: string, content: string, accessToken: string) {
        const postData = {
            kind: "blogger#post",
            blog: { id: blogId },
            title: title,
            content: content
        };

        const response = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error.message}`);
        }

        return await response.json();
    }

    async updateBloggerPost(blogId: string, postId: string, title: string, content: string, accessToken: string) {
        const postData = {
            kind: "blogger#post",
            id: postId,
            blog: { id: blogId },
            title: title,
            content: content
        };

        const response = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/${postId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error.message}`);
        }

        return await response.json();
    }

    async getGoogleApiAccess() {
        try {
            let accessToken = await this.bloggerService.getAccessToken();
            if (accessToken) {
                new Notice('Access token already exists');
                console.log('Access token already exists');
            } else {
                accessToken = await this.bloggerService.requestAccessToken();
                if (accessToken) {
                    new Notice('Access token obtained and saved');
                    console.log('Access token saved at:', this.bloggerService.getTokenPath());
                } else {
                    new Notice('Failed to obtain access token');
                }
            }
        } catch (error) {
            console.error('Error in getGoogleApiAccess:', error);
            new Notice(`Error: ${error.message}`);
        }
    }

    async showBloggerInfo() {
        await this.settings.loadSettings();
        const { blogId, oauthJsonPath, apiKey, bloggerUrl, dateFormat } = this.settings.settings;
        
        console.log('Blogger Info:');
        console.log(`Blog ID: ${blogId || 'Not set'}`);
        console.log(`OAuth JSON Path: ${oauthJsonPath || 'Not set'}`);
        console.log(`API Key: ${apiKey || 'Not set'}`);
        console.log(`Blogger URL: ${bloggerUrl || 'Not set'}`);
        console.log(`Date Format: ${dateFormat || 'Not set'}`);
        
        new Notice('Blogger info has been logged to the console');
        
        new Notice(`Blog ID: ${blogId || 'Not set'}\nOAuth JSON Path: ${oauthJsonPath || 'Not set'}\nAPI Key: ${apiKey || 'Not set'}\nBlogger URL: ${bloggerUrl || 'Not set'}`);
    }

    async uploadImageToGoogleDrive() {
        try {
            const file = this.app.workspace.getActiveFile();
            if (!file || !file.extension.match(/png|jpg|jpeg|gif/i)) {
                new Notice('Please select an image file.');
                return;
            }

            const result = await this.googleDriveService.uploadFile(file);
            if (result.webViewLink) {
                new Notice(`Image uploaded successfully. Link: ${result.webViewLink}`);
            } else {
                new Notice('Image uploaded, but no web view link available.');
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            new Notice(`Error uploading image: ${error.message}`);
        }
    }

    async checkGoogleDriveAuth() {
        new Notice('Checking Google Drive authorization...');
        try {
            const isAuthorized = await this.googleDriveService.checkAuthStatus();
            if (isAuthorized) {
                new Notice('Google Drive is authorized!');
            } else {
                new Notice('Google Drive is not authorized. Please authenticate.');
            }
        } catch (error) {
            console.error('Error checking Google Drive auth:', error);
            new Notice('Error checking Google Drive authorization. Check console for details.');
        }
    }

    async uploadImageToImgur() {
        const file = this.app.workspace.getActiveFile();
        if (!file || !file.extension.match(/png|jpg|jpeg|gif|svg/i)) {
            new Notice('Please select an image file.');
            return;
        }

        try {
            const imageUrl = await this.imgurService.uploadImage(file);
            const imgTag = `<img src="${imageUrl}" alt="${file.name}">`;
            
            await navigator.clipboard.writeText(imgTag);
            new Notice(`Image uploaded successfully. Image tag copied to clipboard.`);
            console.log(`Uploaded image URL: ${imageUrl}`);
        } catch (error) {
            console.error('Error uploading image to Imgur:', error);
            new Notice(`Error uploading image: ${error.message}`);
        }
    }

    onunload() {
        // Plugin 언로드 시 자동으로 이벤트 리스너가 제거됩니다.
    }
}

const formatDate = (date: string, dateFormat: string, language: 'ko' | 'en') => {
    const correctedFormat = dateFormat
        .replace(/YYYY/g, 'yyyy')
        .replace(/DD/g, 'dd')
        .replace(/\(ddd\)/g, language === 'ko' ? '(eee)' : '(EEE)');
    
    const locale = language === 'ko' ? ko : enUS;
    return format(new Date(date), correctedFormat, { locale });
};