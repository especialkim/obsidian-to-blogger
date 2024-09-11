import re
from markdown.extensions import Extension
from markdown.preprocessors import Preprocessor
import markdown

class CalloutPreprocessor(Preprocessor):
    CALLOUT_RE = re.compile(r'^>\s?\[!(\w+)\]\s*(.*?)$', re.MULTILINE)
    LIST_RE = re.compile(r'^(\s*)-\s*(.*)$', re.MULTILINE)

    def run(self, lines):
        new_lines = []
        in_callout = False
        callout_type = ''
        callout_title = ''
        callout_content = []

        for line in lines:
            match = self.CALLOUT_RE.match(line)
            if match:
                if in_callout:
                    new_lines.extend(self.format_callout(callout_type, callout_title, callout_content))
                    callout_content = []
                in_callout = True
                callout_type = match.group(1)
                callout_title = match.group(2).strip()
                content = ''
            elif in_callout and line.startswith('>'):
                callout_content.append(line[1:])
            else:
                if in_callout:
                    new_lines.extend(self.format_callout(callout_type, callout_title, callout_content))
                    in_callout = False
                    callout_type = ''
                    callout_title = ''
                    callout_content = []
                new_lines.append(line)

        if in_callout:
            new_lines.extend(self.format_callout(callout_type, callout_title, callout_content))

        return new_lines

    def format_callout(self, callout_type, callout_title, content):
        # 최소 들여쓰기 찾기
        min_indent = float('inf')
        for line in content:
            stripped_line = line.lstrip()
            if stripped_line.startswith('- '):
                indent = len(line) - len(stripped_line)
                if indent < min_indent:
                    min_indent = indent
        
        if min_indent == float('inf'):
            min_indent = 0

        processed_content = []
        list_stack = []
        current_paragraph = []
        
        for line in content:
            stripped_line = line.lstrip()
            if not stripped_line:  # 빈 줄 처리
                if current_paragraph:
                    processed_content.append('<p>' + '<br>'.join(current_paragraph) + '</p>')
                    current_paragraph = []
                continue

            if stripped_line.startswith('- '):
                if current_paragraph:
                    processed_content.append('<p>' + '<br>'.join(current_paragraph) + '</p>')
                    current_paragraph = []

                indent = len(line) - len(stripped_line)
                item = stripped_line[2:]
                indent_level = (indent - min_indent) // 2  # 2개의 공백을 1단계로 간주

                while list_stack and list_stack[-1] >= indent_level:
                    list_stack.pop()
                    processed_content.append('</ul>')
                
                if not list_stack or indent_level > list_stack[-1]:
                    list_stack.append(indent_level)
                    processed_content.append('<ul>')
                
                # 체크박스 처리
                if item.startswith('[ ]') or item.startswith('[x]'):
                    item = f"☑️ {item[3:]}"
                
                processed_content.append(f'<li>{item}</li>')
            else:
                # 일반 텍스트 처리
                if list_stack:
                    while list_stack:
                        list_stack.pop()
                        processed_content.append('</ul>')
                current_paragraph.append(stripped_line)

        # 남은 단락 처리
        if current_paragraph:
            processed_content.append('<p>' + '<br>'.join(current_paragraph) + '</p>')

        # 남은 리스트 닫기
        while list_stack:
            list_stack.pop()
            processed_content.append('</ul>')

        # 제목 처리
        title = callout_title if callout_title else callout_type

        return [
            f'<div class="callout callout-{callout_type.lower()}">',
            f'<p class="callout-title">{title}</p>',
            '<div class="callout-content">',
            '\n'.join(processed_content),
            '</div>',
            '</div>',
            ''
        ]

class CalloutExtension(Extension):
    def extendMarkdown(self, md):
        md.preprocessors.register(CalloutPreprocessor(md), 'callout', 175)

def makeExtension(**kwargs):
    return CalloutExtension(**kwargs)