import pickle
from pathlib import Path
from googleapiclient import discovery
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
import markdown
from callout_extension import CalloutExtension
from checkbox_processor import CheckboxExtension

CLIENT_SECRET = '_ Images/client_secret_472365426792-thqq130u8j7m6mamubko0uu625j9f78l.apps.googleusercontent.com.json'  # OAuth 클라이언트 json 파일 경로
SCOPES = ['https://www.googleapis.com/auth/blogger']  # Blogger OAuth Scope


def get_blogger_service_obj():
    creds = None
    if Path("auto_token.pickle").exists():
        with open('auto_token.pickle', 'rb') as token:
            creds = pickle.load(token)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET, SCOPES)
            creds = flow.run_local_server(port=0)
        with open('auto_token.pickle', 'wb') as token:
            pickle.dump(creds, token)

    return discovery.build('blogger', 'v3', credentials=creds)

def blog_posting(blog_id, title, content, hashtags, draft=False):
    blogger_service = get_blogger_service_obj()
    posts = blogger_service.posts()

    # Markdown을 HTML로 변환
    html_content = markdown.markdown(content, extensions=['extra', 'codehilite', CheckboxExtension(), CalloutExtension()])

    data = {
        'title': title,
        'content': html_content,
        'labels': hashtags,
        'blog': {
            'id': blog_id
        }
    }

    response = posts.insert(blogId=blog_id,
                            body=data,
                            isDraft=draft,
                            fetchImages=True).execute()

    print("printing the page id:", response['id'])


blog_id = "494344720696871144"  # 여기에 실제 블로그 ID를 입력하세요
title = "Markdown 콜아웃 테스트22"
content = """
# Heading1

## Heading2

제목(Heading)은 `#`을 사용합니다.

## 인용구

인용구는 `>` 를 사용합니다.

> 인용구
> 
> 인간은 과거로부터 교훈을 얻고, 미래를 예측하며, 목표를 성취하기 위해 계획을 세운다. 
> <운동의 뇌과학>

## Callout

> [!Note] 주의하세요!
> Obsidian을 활용해서 자신만의 지식 세계를 구축해세요.
> 그럴수 있죠?
> 
> 어서요.
> 
> - 안녕하세요. 반갑습니다.
>   - 이건 어쩔꺼영?
> - 이거지이거지

> [!Warning]
> Obsidian을 활용해서 자신만의 지식 세계를 구축해세요.
> 어서요.
> 
> - [ ] 이건가? 이것도 되려나
>   - 이건 어쩔 꺼여? 

## List

- 리스트1
	- 리스트1.1
	- 리스트1.2
- 리스트2
	- 리스트2.1

## Task

- [ ] 테스트다.
    - 이것도 이건?
- 이것도?
- 이건?
    - 이건?

## Code

### Code Block

```C
print("Helloworld!)
```

### Inline Code

C언어 출력 함수는 `printf()`입니다.


## Mermaid

```mermaid
graph LR
A --> B --> C
B --> D
D --> E
C --> G
E --> G
```

## 더 많은 내용

- [Basic formatting syntax - Obsidian Help](https://help.obsidian.md/Editing+and+formatting/Basic+formatting+syntax)
- [Advanced formatting syntax - Obsidian Help](https://help.obsidian.md/Editing+and+formatting/Advanced+formatting+syntax)
- [Obsidian Flavored Markdown - Obsidian Help](https://help.obsidian.md/Editing+and+formatting/Obsidian+Flavored+Markdown)

"""
hashtags = ["Markdown", "테스트", "블로그", "자동화", "파이썬"]
blog_posting(blog_id, title, content, hashtags, draft=False)