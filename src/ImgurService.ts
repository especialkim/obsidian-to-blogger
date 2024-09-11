import { TFile, Vault } from 'obsidian';
import axios from 'axios';

export class ImgurService {
    private clientId: string;

    constructor(private vault: Vault, clientId: string) {
        this.clientId = clientId;
    }

    async uploadImage(file: TFile, maxRetries = 3, delay = 1000): Promise<string> {
        console.log(`Attempting to upload image: ${file.name}`);
        let imageBlob: Blob;

        if (file.extension.toLowerCase() === 'svg') {
            imageBlob = await this.convertSvgToPng(file);
        } else {
            const buffer = await this.vault.readBinary(file);
            imageBlob = new Blob([buffer]);
        }

        for (let i = 0; i < maxRetries; i++) {
            try {
                const formData = new FormData();
                formData.append('image', imageBlob, file.name.replace('.svg', '.png'));

                const response = await axios.post('https://api.imgur.com/3/image', formData, {
                    headers: {
                        Authorization: `Client-ID ${this.clientId}`
                    }
                });

                if (response.data.success) {
                    return response.data.data.link;
                } else {
                    throw new Error('Failed to upload image to Imgur');
                }
            } catch (error) {
                if (error.response && error.response.status === 429 && i < maxRetries - 1) {
                    console.log(`Rate limit hit, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                console.error('Error uploading to Imgur:', error);
                throw error;
            }
        }
        throw new Error('Max retries reached');
    }

    private async convertSvgToPng(file: TFile): Promise<Blob> {
        const svgContent = await this.vault.read(file);
        return this.svgToPng(svgContent);
    }

    private svgToPng(svgString: string): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0);
                canvas.toBlob(blob => {
                    if (blob) resolve(blob);
                    else reject(new Error('Failed to convert SVG to PNG'));
                }, 'image/png');
            };
            img.onerror = () => reject(new Error('Failed to load SVG'));
            // 수정된 부분: btoa 대신 encodeURIComponent 사용
            img.src = `data:image/svg+xml,${encodeURIComponent(svgString)}`;
        });
    }
}