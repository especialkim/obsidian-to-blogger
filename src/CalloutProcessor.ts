export class CalloutProcessor {
    // 콜아웃 시작을 감지하는 정규표현식
    private static CALLOUT_RE = /^>\s?\[!(\w+)\]\s*(.*?)$/;
    // 목록 항목을 감지하는 정규표현식
    private static LIST_RE = /^(\s*)-\s*(.*)$/;

    static process(content: string): string {
        const lines = content.split('\n');
        const newLines: string[] = [];
        let inCallout = false;
        let calloutType = '';
        let calloutTitle = '';
        let calloutContent: string[] = [];

        // 각 줄을 순회하며 콜아웃을 처리
        for (const line of lines) {
            const match = line.match(this.CALLOUT_RE);
            if (match) {
                // 새로운 콜아웃 시작
                if (inCallout) {
                    // 이전 콜아웃이 있다면 처리
                    newLines.push(...this.formatCallout(calloutType, calloutTitle, calloutContent));
                    calloutContent = [];
                }
                inCallout = true;
                calloutType = match[1];
                calloutTitle = match[2].trim();
            } else if (inCallout && line.startsWith('>')) {
                // 콜아웃 내용 처리
                calloutContent.push(line.slice(1)); // '>' 문자 제거
            } else {
                // 콜아웃 종료 또는 일반 텍스트
                if (inCallout) {
                    newLines.push(...this.formatCallout(calloutType, calloutTitle, calloutContent));
                    inCallout = false;
                    calloutType = '';
                    calloutTitle = '';
                    calloutContent = [];
                }
                newLines.push(line);
            }
        }

        // 마지막 콜아웃 처리
        if (inCallout) {
            newLines.push(...this.formatCallout(calloutType, calloutTitle, calloutContent));
        }

        return newLines.join('\n');
    }

    private static formatCallout(calloutType: string, calloutTitle: string, content: string[]): string[] {
        // 콜아웃 내용 처리
        const processedContent = this.processCalloutContent(content);
        // HTML 형식으로 콜아웃 구성
        return [
            `<div class="callout callout-${calloutType.toLowerCase()}">`,
            `<div class="callout-title">${calloutTitle || calloutType}</div>`,
            '<div class="callout-content">',
            processedContent,
            '</div>',
            '</div>',
            ''
        ];
    }

    private static processCalloutContent(content: string[]): string {
        let processedContent: string[] = [];
        let currentParagraph: string[] = [];
        let listStack: number[] = [];
        let minIndent = Infinity;

        // 최소 들여쓰기 찾기
        // console.log('Starting to find minimum indent');
        for (const line of content) {
            // console.log('Processing line:', line);
            const match = line.match(/^(\s*)>?\s*-/);
            if (match) {
                const indent = match[1].length;
                // console.log('Found list item. Indent:', indent);
                minIndent = Math.min(minIndent, indent);
                // console.log('Updated minIndent:', minIndent);
            } else {
                // console.log('Not a list item');
            }
        }

        if (minIndent === Infinity) {
            // console.log('No indent found, setting minIndent to 0');
            minIndent = 0;
        } else {
            // console.log('Final minIndent:', minIndent);
        }

        // console.log('Minimum indent:', minIndent);

        for (const line of content) {
            const cleanedLine = line.replace(/^>\s*/, '');  // '>' 문자와 그 뒤의 공백 제거
            const strippedLine = cleanedLine.trimStart();

            if (!strippedLine) {
                if (currentParagraph.length > 0) {
                    processedContent.push(`<p>${currentParagraph.join('<br>')}</p>`);
                    currentParagraph = [];
                }
                continue;
            }

            if (strippedLine.startsWith('-')) {
                if (currentParagraph.length > 0) {
                    processedContent.push(`<p>${currentParagraph.join('<br>')}</p>`);
                    currentParagraph = [];
                }

                const indent = cleanedLine.length - strippedLine.length;
                const item = strippedLine.slice(1).trim();
                const indentLevel = Math.max(0, Math.floor((indent - minIndent))) + 1;
                
                // console.log('Current item:', item, 'Indent:', indent, 'MinIndent:', minIndent, 'Indent level:', indentLevel);

                // 현재 레벨에 맞게 목록 구조 조정
                if (listStack.length > indentLevel) {
                    while (listStack.length > indentLevel) {
                        listStack.pop();
                        processedContent.push('</ul>');
                    }
                } else if (listStack.length < indentLevel) {
                    while (listStack.length < indentLevel) {
                        processedContent.push('<ul>');
                        listStack.push(listStack.length);
                    }
                }

                let processedItem = item;
                if (item.startsWith('[ ]') || item.startsWith('[x]')) {
                    processedItem = `☑️ ${item.slice(3)}`;
                }

                processedContent.push(`<li>${processedItem}</li>`);
            } else {
                // 목록이 끝났을 때 모든 열린 목록 태그 닫기
                while (listStack.length > 0) {
                    listStack.pop();
                    processedContent.push('</ul>');
                }
                currentParagraph.push(strippedLine);
            }
        }

        if (currentParagraph.length > 0) {
            processedContent.push(`<p>${currentParagraph.join('<br>')}</p>`);
        }

        // 남은 목록 태그 닫기
        while (listStack.length > 0) {
            listStack.pop();
            processedContent.push('</ul>');
        }

        return processedContent.join('\n');
    }
}