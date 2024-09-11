import { App, TFile } from 'obsidian';
import { SettingsManager } from './SettingsManager';
import { ImgurService } from './ImgurService';
import { MermaidService } from './MermaidService';
import { D2Service } from './D2Service';

export class GetActiveFileContent {
    private mermaidService: MermaidService;
    private d2Service: D2Service;

    constructor(
        private app: App, 
        private settingsManager: SettingsManager,
        private imgurService: ImgurService
    ) {
        this.mermaidService = new MermaidService(this);
        this.d2Service = new D2Service(this);
    }

    getActiveFile(): TFile | null {
        return this.app.workspace.getActiveFile();
    }

    async getContent(): Promise<string | null> {
        const activeFile = this.getActiveFile();
        if (activeFile) {
            const content = await this.app.vault.read(activeFile);
            const processedContent = this.processContent(content);
            const contentWithProcessedImages = await this.processImageLinks(processedContent);
            const contentWithProcessedLinks = await this.processInternalLinks(contentWithProcessedImages);
            const result = await this.processCodeblocks(contentWithProcessedLinks);
            console.log('result: ', result);
            return result;
        }
        return null;
    }

    private async processImageLinks(content: string): Promise<string> {
        const regex = /!\[\[(.*?\.(?:png|jpe?g|gif|svg)(?:\.[\w]+)*)(?:\|[^\]]+)?\]\]/gi;
        const promises: Promise<string>[] = [];

        content = content.replace(regex, (match, fileName) => {
            console.log('fileName: ', fileName);
            const promise = this.uploadAndReplaceImage(fileName);
            promises.push(promise);
            return match; // 임시로 원래 매치를 지
        });

        const replacements = await Promise.all(promises);
        let index = 0;
        return content.replace(regex, (match, fileName, offset, string) => {
            const replacement = replacements[index++];
            return replacement;
        });
    }

    public async uploadAndReplaceImage(fileName: string): Promise<string> {
        try {
            const filePath = this.findFilePath(fileName);
            if (filePath) {
                const file = this.app.vault.getAbstractFileByPath(filePath);
                if (file instanceof TFile) {
                    const url = await this.imgurService.uploadImage(file);
                    // 파일 이름에서 확장자 제거
                    const fileNameWithoutExtension = fileName.replace(/\.[^/.]+$/, "");
                    console.log('imgur url: ', url);
                    return `![${fileNameWithoutExtension}](${url})`;
                }
            }
        } catch (error) {
            console.error(`Error uploading image ${fileName}:`, error);
        }
        return `![[${fileName}]]`; // 업로드 실패 시 원래 형식 유지
    }

    private findFilePath(fileName: string): string | null {
        // 볼트의 모든 파일을 가져옵니다.
        const files = this.app.vault.getFiles();
        
        // 파일 이름이 일치하는 일을 찾습니다.
        const matchedFile = files.find(file => file.name === fileName);
        
        if (matchedFile) {
            return matchedFile.path;
        }
        
        return null;
    }

    getFileName(): string | null {
        const activeFile = this.getActiveFile();
        if (!activeFile) return null;

        let fileName = activeFile.name;
        
        // 확장자 제거
        fileName = fileName.replace(/\.[^/.]+$/, "");
        
        // prefix 처리
        if (fileName[1] === ' ') {
            fileName = fileName.substring(2);
        }

        return fileName;
    }

    private processContent(content: string): string {

        // Remove frontmatter only if it starts at the beginning of the document
        const frontmatterRegex = /^\s*---\s*\n(?:.*\n)*?---\s*\n/;
        content = content.replace(frontmatterRegex, '');

        const { startMarker, endMarker, includeStartMarker, includeEndMarker } = this.settingsManager.settings;

        let startIndex = 0;
        let endIndex = content.length;

        if (startMarker) {
            const markerIndex = content.indexOf(startMarker);
            if (markerIndex !== -1) {
                startIndex = includeStartMarker ? markerIndex : markerIndex + startMarker.length;
            }
        }

        if (endMarker) {
            const markerIndex = content.indexOf(endMarker, startIndex);
            if (markerIndex !== -1) {
                endIndex = includeEndMarker ? markerIndex + endMarker.length : markerIndex;
            }
        }

        return content.slice(startIndex, endIndex).trim();
    }

    private async processInternalLinks(content: string): Promise<string> {
        const regex = /\[\[([^\]]+)\]\]/g;
        const matches = Array.from(content.matchAll(regex));
        const replacements = await Promise.all(
            matches.map(async ([match, linkText]) => {
                // 이미지 링크는 처리하지 않음
                if (linkText.match(/\.(png|jpe?g|gif|svg)$/i)) {
                    return { match, replacement: match };
                }

                let linkPath = this.findFilePath(linkText + '.svg');
                if (linkPath) {
                    console.log('SVG 파일 링크 처리:', linkText);
                    const file = this.app.vault.getAbstractFileByPath(linkPath);
                    if (file instanceof TFile) {
                        const svgUrl = await this.imgurService.uploadImage(file);
                        return { match, replacement: `[${linkText}](${svgUrl})` };
                    }
                }

                linkPath = this.findFilePath(linkText + '.md');
                if (linkPath) {
                    console.log('마크다운 파 링크 처리:', linkText);
                    const result = await this.processMarkdownLink(linkPath, linkText);
                    console.log('result: ', result);
                    return { match, replacement: result };
                } else {
                    console.log('마크다운이 아닌 파일 링크 처리:', linkText);
                    // 마크다운이 아닌 일은 일반 텍스트로 변경
                    return { match, replacement: linkText };
                }
            })
        );

        replacements.forEach(({ match, replacement }) => {
            content = content.replace(match, replacement);
        });

        return content;
    }

    private async processMarkdownLink(filePath: string, linkText: string): Promise<string> {
        const file = this.app.vault.getAbstractFileByPath(filePath);

        if (file instanceof TFile) {
            const metadata = this.app.metadataCache.getFileCache(file);
            const postUrl = metadata?.frontmatter?.PostUrl;
            console.log(metadata, postUrl);
            if (postUrl) {
                return `**[${linkText}](${postUrl})**`;
            }
        }
        return `**${linkText}**`;
    }

    private async processCodeblocks(content: string): Promise<string> {
        const codeBlockRegex = /```\s*(\w*)\s*render\s*(.*?)\n([\s\S]*?)```/g;
        const matches = Array.from(content.matchAll(codeBlockRegex));
        
        for (const [match, language, alt, code] of matches) {
            const trimmedAlt = alt.trim();
            const rendered = await this.renderCodeBlock(language, code.trim(), trimmedAlt);
            content = content.replace(match, rendered);
        }
        
        return content;
    }

    private async renderCodeBlock(language: string, code: string, alt: string): Promise<string> {
        if (language.toLowerCase() === 'mermaid') {
            return await this.mermaidService.renderToSvg(code, alt);
        } else if (language.toLowerCase() === 'd2') {
            return await this.d2Service.renderToImageURL(code, alt);
        }
        // 다른 언어에 대한 기본 반환
        return `\`\`\`${language}\n${code}\n\`\`\``;
    }

    private parseFrontmatter(content: string): Record<string, any> | null {
        const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
        const match = content.match(frontmatterRegex);
        
        if (match && match[1]) {
            const frontmatterContent = match[1];
            const frontmatter: Record<string, any> = {};
            
            frontmatterContent.split('\n').forEach(line => {
                const [key, value] = line.split(':').map(part => part.trim());
                if (key && value) {
                    frontmatter[key] = value;
                }
            });
            
            return frontmatter;
        }
        
        return null;
    }

    public getVaultAdapter() {
        return this.app.vault.adapter;
    }

    public async removeFile(filePath: string): Promise<void> {
        await this.app.vault.adapter.remove(filePath);
    }
}