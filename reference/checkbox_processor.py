import re
from markdown.extensions import Extension
from markdown.preprocessors import Preprocessor

class CheckboxPreprocessor(Preprocessor):
    CHECKBOX_RE = re.compile(r'^\s*-\s*\[([ x])\]\s*(.*)$', re.MULTILINE)

    def run(self, lines):
        new_lines = []
        for line in lines:
            checkbox_match = self.CHECKBOX_RE.match(line)
            if checkbox_match:
                _, text = checkbox_match.groups()
                line = f"- ☑️ {text}"
            new_lines.append(line)
        return new_lines

class CheckboxExtension(Extension):
    def extendMarkdown(self, md):
        md.preprocessors.register(CheckboxPreprocessor(md), 'checkbox', 200)

def makeExtension(**kwargs):
    return CheckboxExtension(**kwargs)