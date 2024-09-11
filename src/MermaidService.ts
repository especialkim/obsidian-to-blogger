import { GetActiveFileContent } from './GetActiveFileContent';
import mermaid from 'mermaid';

export class MermaidService {
    constructor(private getActiveFileContent: GetActiveFileContent) {}

    async renderToSvg(code: string, alt: string): Promise<string> {
        console.log('MermaidService: Rendering mermaid code to SVG');
        
        try {
            // Mermaid 초기화 및 CSS 설정
            mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                themeCSS: `
                    .node rect { fill: #f4f4f4; stroke: #999; }
                    .edgeLabel { background-color: #f4f4f4; }
                    .cluster rect { fill: #f4f4f4; stroke: #999; }
                `
            });

            // Mermaid 코드를 SVG로 변환
            const { svg } = await mermaid.render('mermaid-diagram', code);

            // SVG를 임시 파일로 저장
            const tempFileName = alt ? `${alt}.svg` : `temp-mermaid-${Date.now()}.svg`;
            await this.getActiveFileContent.getVaultAdapter().write(tempFileName, svg);

            // 임시 파일을 업로드하고 URL 얻기
            console.log('tempFileName: ', tempFileName);
            const imageUrl = await this.getActiveFileContent.uploadAndReplaceImage(tempFileName);

            // 임시 파일 삭제
            await this.getActiveFileContent.removeFile(tempFileName);

            // 마크다운 이미지 문법으로 URL 반환 (alt 텍스트 포함)
            return imageUrl;
        } catch (error) {
            console.error('Error rendering mermaid diagram:', error);
            return `Error rendering mermaid diagram: ${error.message}`;
        }
    }
}