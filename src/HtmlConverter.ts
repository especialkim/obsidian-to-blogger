import { marked } from 'marked';
import { CalloutProcessor } from './CalloutProcessor';
import { SettingsManager } from './SettingsManager';

export class HtmlConverter {
    private settingsManager: SettingsManager;

    constructor(settingsManager: SettingsManager) {
        this.settingsManager = settingsManager;
    }

    async convertObsidianToHtml(markdown: string): Promise<string> {
        const preprocessed = this.preprocessObsidianSyntax(markdown);
        const withCallouts = CalloutProcessor.process(preprocessed);
        let html = await this.convertToHtml(withCallouts);
        html = this.restructureNestedLists(html);
        html = this.convertYoutubeLinksToIframes(html);
        
        if (this.settingsManager.settings.useHtmlWrapClass) {
            const className = this.settingsManager.settings.htmlWrapClassName || 'obsidian-content';
            return `<div class="${className}">\n${html}\n</div>`;
        }
        
        return html;
    }

    private preprocessObsidianSyntax(markdown: string): string {
        // Obsidian 특유의 문법 처리 (예: 내부 링크)
        return markdown.replace(/\[\[(.*?)\]\]/g, (match, p1) => {
            const parts = p1.split('|');
            const text = parts.length > 1 ? parts[1] : parts[0];
            return `[${text}](${parts[0]})`;
        });
    }

    private async convertToHtml(markdown: string): Promise<string> {
        try {
            return marked.parse(markdown);
        } catch (err) {
            throw new Error(`Markdown parsing failed: ${err}`);
        }
    }

    private restructureNestedLists(html: string): string {
        // console.log('Before restructuring:', html);

        // 1. <li>{텍스트}<ul> 또는 <li>{텍스트}<ol>를 <li>{텍스트}</li><ul> 또는 <li>{텍스트}</li><ol>로 변경 (이미 </li>가 있는 경우 제외)
        html = html.replace(/(<li[^>]*>)((?:(?!<\/li>).)*?)(<[ou]l>)/g, '$1$2</li>\n$3');

        // 2. </ul> 또는 </ol> {공백 또는 줄바꿈~~} </li> 를 </ul> 또는 </ol>로 대치
        html = html.replace(/<\/([ou]l)>\s*<\/li>/g, '</$1>');

        // console.log('After restructuring:', html);

        return html;
    }

    private convertYoutubeLinksToIframes(html: string): string {
        const youtubeRegex = /<img\s+src="(https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)(\S*))"\s+alt="(.*)"\s*\/?>/g;
        return html.replace(youtubeRegex, (match, url, _, __, videoId, params, alt) => {
            const embedUrl = `https://www.youtube.com/embed/${videoId}${params}`;
            return `<div class="youtube-embed-wrapper"><iframe class="youtube-embed" src="${embedUrl}" title="${alt}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
        });
    }
}