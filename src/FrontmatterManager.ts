import { TFile, Vault } from 'obsidian';

export class FrontmatterManager {
    constructor(private vault: Vault) {}

    async updateFrontmatter(file: TFile, postData: {id: string, url: string, publishedDate: string, updatedDate: string}) {
        const frontmatter = this.createFrontmatter(postData);
        const updatedContent = await this.addFrontmatterToContent(file, frontmatter);
        await this.vault.modify(file, updatedContent);
    }

    private createFrontmatter(postData: {id: string, url: string, publishedDate: string, updatedDate: string}): Record<string, string> {
        return {
            Type: 'Blogger',
            PostID: postData.id,
            PostUrl: postData.url,
            Published: postData.publishedDate,
            Updated: postData.updatedDate
        };
    }

    private async addFrontmatterToContent(file: TFile, newFrontmatter: Record<string, string>): Promise<string> {
        const content = await this.vault.read(file);
        const existingFrontmatter = await this.getFrontmatter(file) || {};
        
        // 새 frontmatter로 기존 frontmatter 업데이트
        const updatedFrontmatter = { ...existingFrontmatter, ...newFrontmatter };
        
        const frontmatterString = this.createFrontmatterString(updatedFrontmatter);
        
        const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
        if (frontmatterRegex.test(content)) {
            return content.replace(frontmatterRegex, frontmatterString);
        } else {
            return frontmatterString + content;
        }
    }

    private createFrontmatterString(frontmatter: Record<string, string>): string {
        let result = '---\n';
        for (const [key, value] of Object.entries(frontmatter)) {
            result += `${key}: ${value}\n`;
        }
        result += '---\n\n';
        return result;
    }

    async getFrontmatter(file: TFile): Promise<Record<string, string> | null> {
        const content = await this.vault.cachedRead(file);
        const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
        const match = content.match(frontmatterRegex);
        
        if (match) {
            const frontmatterContent = match[1];
            const frontmatter: Record<string, string> = {};
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
}