import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import BloggerPublishPlugin from '../main';

export interface BloggerPublishSettings {  // export 키워드 추가
    oauthJsonPath: string;
    apiKey: string; // 추가
    blogId: string;
    bloggerUrl: string; // 추가
    // accessToken 제거
    startMarker: string;
    includeStartMarker: boolean;
    endMarker: string;
    includeEndMarker: boolean;
    useHtmlWrapClass: boolean;
    htmlWrapClassName: string;
    accessTokenPath: string; // 새로운 필드 추가
    dateFormat: string;
    dateLanguage: 'ko' | 'en';  // 새로운 필드 추가
    imgurClientId: string; // 새로 추가
    openBrowserAfterPublish: boolean; // 새로운 옵션 추가
}

const DEFAULT_SETTINGS: BloggerPublishSettings = {
    oauthJsonPath: '',
    apiKey: '', // 추가
    blogId: '',
    bloggerUrl: 'https://', // 추가
    // accessToken 제거
    startMarker: '',
    includeStartMarker: false,
    endMarker: '',
    includeEndMarker: false,
    useHtmlWrapClass: false,
    htmlWrapClassName: 'obsidian-content',
    accessTokenPath: '', // 새로운 필드 추가
    dateFormat: '"[[YYYY-MM-DD(ddd)|YYYY-MM-DD(ddd) HH:mm]]"',
    dateLanguage: 'ko',  // 기본값은 한국어
    imgurClientId: '', // 새로 추가
    openBrowserAfterPublish: false, // 기본값은 false로 설정
};

export class SettingsManager extends PluginSettingTab {
    plugin: BloggerPublishPlugin;
    settings: BloggerPublishSettings;

    constructor(app: App, plugin: BloggerPublishPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.settings = DEFAULT_SETTINGS;
    }

    async loadSettings() {
        const loadedSettings = await this.plugin.loadData();
        this.settings = { ...DEFAULT_SETTINGS, ...loadedSettings };
    }

    async saveSettings() {
        await this.plugin.saveData(this.settings);
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('OAuth Client Secret JSON File')
            .setDesc('Select the OAuth client secret JSON file from your vault')
            .addDropdown(dropdown => {
                // JSON 파일만 필터링
                const jsonFiles = this.app.vault.getFiles().filter(file => file.extension === 'json');
                
                // 드롭다운 옵션 설
                jsonFiles.forEach(file => {
                    dropdown.addOption(file.path, file.path);
                });

                // 현재 설정값 선택
                dropdown.setValue(this.settings.oauthJsonPath);

                // 변경 이벤트 처리
                dropdown.onChange(async (value) => {
                    this.settings.oauthJsonPath = value;
                    await this.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName('Access Token Path')
            .setDesc('Select the JSON file where the access token will be stored')
            .addDropdown(dropdown => {
                // JSON 파일만 필터링
                const jsonFiles = this.app.vault.getFiles().filter(file => file.extension === 'json');
                
                // 드롭다운 옵션 설정
                jsonFiles.forEach(file => {
                    dropdown.addOption(file.path, file.path);
                });

                // 현재 설정값 선택
                dropdown.setValue(this.settings.accessTokenPath);

                // 변경 이벤트 처리
                dropdown.onChange(async (value) => {
                    this.settings.accessTokenPath = value;
                    await this.saveSettings();
                });
            });

        // 인증 상태에 따른 추가 설명
        if (!this.settings.accessTokenPath) {
            containerEl.createEl('p', {
                text: 'Authenticate first to get an access token.',
                cls: 'setting-item-description'
            });
        }

        new Setting(containerEl)
            .setName('API Key')
            .setDesc('Enter your Blogger API Key')
            .addText(text => text
                .setPlaceholder('Enter your API Key')
                .setValue(this.settings.apiKey)
                .onChange(async (value) => {
                    this.settings.apiKey = value;
                    await this.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Blog ID')
            .setDesc('Enter your Blogger blog ID')
            .addText(text => text
                .setPlaceholder('Enter your blog ID')
                .setValue(this.settings.blogId)
                .onChange(async (value) => {
                    this.settings.blogId = value;
                    await this.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Blogger URL')
            .setDesc('Enter your Blogger URL')
            .addText(text => text
                .setPlaceholder('https://yourblog.blogspot.com')
                .setValue(this.settings.bloggerUrl)
                .onChange(async (value) => {
                    // Ensure the URL starts with https://
                    if (!value.startsWith('https://')) {
                        value = 'https://' + value;
                    }
                    this.settings.bloggerUrl = value;
                    await this.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include Start Marker')
            .setDesc('Include the line with the start marker in the output')
            .addToggle(toggle => toggle
                .setValue(this.settings.includeStartMarker)
                .onChange(async (value) => {
                    this.settings.includeStartMarker = value;
                    await this.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Start Marker')
            .setDesc('Text to mark the start of the content to be published')
            .addText(text => text
                .setPlaceholder('Enter start marker')
                .setValue(this.settings.startMarker)
                .onChange(async (value) => {
                    this.settings.startMarker = value;
                    await this.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include End Marker')
            .setDesc('Include the line with the end marker in the output')
            .addToggle(toggle => toggle
                .setValue(this.settings.includeEndMarker)
                .onChange(async (value) => {
                    this.settings.includeEndMarker = value;
                    await this.saveSettings();
                }));

        new Setting(containerEl)
            .setName('End Marker')
            .setDesc('Text to mark the end of the content to be published')
            .addText(text => text
                .setPlaceholder('Enter end marker')
                .setValue(this.settings.endMarker)
                .onChange(async (value) => {
                    this.settings.endMarker = value;
                    await this.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Use HTML Wrap Class')
            .setDesc('Wrap the converted HTML in a div with a custom class')
            .addToggle(toggle => toggle
                .setValue(this.settings.useHtmlWrapClass)
                .onChange(async (value) => {
                    this.settings.useHtmlWrapClass = value;
                    await this.saveSettings();
                }));

        new Setting(containerEl)
            .setName('HTML Wrap Class Name')
            .setDesc('Class name for the wrapping div (if enabled)')
            .addText(text => text
                .setPlaceholder('Enter class name')
                .setValue(this.settings.htmlWrapClassName)
                .onChange(async (value) => {
                    this.settings.htmlWrapClassName = value;
                    await this.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Date Format')
            .setDesc('Specify the format for dates (e.g., "[[YYYY-MM-DD(ddd)|YYYY-MM-DD(ddd) HH:mm]]")')
            .addText(text => text
                .setPlaceholder('Enter date format')
                .setValue(this.settings.dateFormat)
                .onChange(async (value) => {
                    this.settings.dateFormat = value;
                    await this.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Date Language')
            .setDesc('Choose the language for date formatting')
            .addDropdown(dropdown => dropdown
                .addOption('ko', '한국어')
                .addOption('en', 'English')
                .setValue(this.settings.dateLanguage)
                .onChange(async (value: 'ko' | 'en') => {
                    this.settings.dateLanguage = value;
                    await this.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Imgur Client ID')
            .setDesc('Enter your Imgur Client ID')
            .addText(text => text
                .setPlaceholder('Enter your client id')
                .setValue(this.settings.imgurClientId)
                .onChange(async (value) => {
                    this.settings.imgurClientId = value;
                    await this.saveSettings();
                }));

        // 새로운 설정 추가
        new Setting(containerEl)
            .setName('Open Browser After Publish')
            .setDesc('Automatically open the published post in browser after successful upload')
            .addToggle(toggle => toggle
                .setValue(this.settings.openBrowserAfterPublish)
                .onChange(async (value) => {
                    this.settings.openBrowserAfterPublish = value;
                    await this.saveSettings();
                }));

        // ... 기존 코드 ...
    }
}