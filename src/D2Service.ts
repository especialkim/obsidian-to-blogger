import { GetActiveFileContent } from './GetActiveFileContent';
import { exec } from 'child_process';
import { promisify } from 'util';
import { FileSystemAdapter } from 'obsidian';
import * as path from 'path';

const execAsync = promisify(exec);

export class D2Service {
    constructor(private getActiveFileContent: GetActiveFileContent) {}

    async renderToImageURL(code: string, alt: string): Promise<string> {
        console.log('D2Service: Rendering D2 code to image URL');
        
        try {
            // 임시 D2 파일 생성
            const tempD2FileName = `${alt}.d2`;
            console.log(`Creating temporary D2 file: ${tempD2FileName}`);
            await this.getActiveFileContent.getVaultAdapter().write(tempD2FileName, code);

            // FileSystemAdapter의 getFullPath 메서드를 사용하여 전체 경로 가져오기
            const adapter = this.getActiveFileContent.getVaultAdapter() as FileSystemAdapter;
            const tempD2FilePath = adapter.getFullPath(tempD2FileName);

            console.log(`Temporary D2 file path: ${tempD2FilePath}`);
            console.log('Temporary D2 file created successfully');

            // 전체 폴더 경로 추출
            const folderPath = path.dirname(tempD2FilePath) + '/';
            console.log(`Folder path: ${folderPath}`);

            // GIF 파일 이름 설정
            const tempSvgFileName = `${alt}.svg`;
            const tempSvgFilePath = path.join(folderPath, tempSvgFileName);
            console.log(`Setting SVG file path: ${tempSvgFilePath}`);

            // d2 실행 파일의 전체 경로를 지정합니다
            const d2Path = '/opt/homebrew/bin/d2';  // 실제 d2 실행 파일 경로로 변경하세요

            console.log(`Executing D2 CLI command: ${d2Path} "${tempD2FilePath}" "${tempSvgFilePath}"`);
            const { stdout, stderr } = await execAsync(`"${d2Path}" "${tempD2FilePath}" "${tempSvgFilePath}"`);
            console.log('D2 CLI execution output:', stdout);
            if (stderr) console.error('D2 CLI execution error:', stderr);

            // SVG를 업로드하고 URL 얻기
            console.log('Uploading SVG and getting URL');
            console.log('tempSvgFileName: ', tempSvgFileName);
            const imageUrl = await this.getActiveFileContent.uploadAndReplaceImage(tempSvgFileName);
            console.log('Image URL obtained:', imageUrl);

            // 임시 파일들 삭제
            console.log('Removing temporary files');
            // await this.getActiveFileContent.removeFile(tempD2FileName);
            // await this.getActiveFileContent.removeFile(tempSvgFileName);
            console.log('Temporary files removed successfully');

            // 마크다운 이미지 문법으로 URL 반환
            return imageUrl;
        } catch (error) {
            console.error('Error rendering D2 diagram:', error);
            return `Error rendering D2 diagram: ${error.message}`;
        }
    }
}