# DataLens AI 중계 서버

회사 Azure OpenAI 키를 DataLens 배포(다른 사람 Vercel 계정)에 넣지 않고 AI 분류를 쓰기 위한 작은 서버입니다.

```
DataLens 배포 ──(출입증)──▶ AI 중계 서버(내 Vercel, 회사 키 보관) ──▶ Azure OpenAI
```

- 회사 키는 이 서버에만 있습니다. DataLens 배포에는 이 서버 주소와 출입증만 넣습니다.
- 출입증(`RELAY_TOKEN`)이 맞는 요청만 받습니다. 출입증을 바꾸면 기존 출입증은 바로 막힙니다.
- 요청 크기(256KB)와 응답 길이(출력 8,000토큰)에 상한이 있습니다. 비용 한도는 Azure 쪽 할당량으로 거세요.
- 요청·응답 내용과 키는 로그에 남기지 않습니다. DataLens는 개인정보를 가린 민원만 보냅니다.

## 1. 출입증 만들기

긴 임의 문자열을 하나 만듭니다(32자 이상). 아래 둘 중 하나를 실행하세요.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

## 2. 내 Vercel에 배포

1. Vercel → **Add New → Project** → GitHub 저장소 `nounsoft/datalens-test` **Import**
2. **Root Directory**: `ai-relay` (Edit 눌러 지정). Framework Preset: **Other**
3. **Environment Variables**(Production):

| 이름 | 값 |
| --- | --- |
| `AZURE_OPENAI_ENDPOINT` | Azure 리소스의 Endpoint (예: `https://리소스.openai.azure.com/` 또는 `.../openai/v1`) |
| `AZURE_OPENAI_API_KEY` | Azure 키 (Sensitive) |
| `AZURE_OPENAI_API_VERSION` | `2024-10-21` (엔드포인트가 `/openai/v1`로 끝나면 비워 둠) |
| `AZURE_OPENAI_DEPLOYMENT_FAST` | 배포 이름(대량 분류용) |
| `AZURE_OPENAI_DEPLOYMENT_DEEP` | 배포 이름(하나뿐이면 FAST와 같게) |
| `RELAY_TOKEN` | 1번에서 만든 출입증 (Sensitive) |

4. **Deploy** → 나온 주소를 적어 둡니다. 중계 주소는 `https://<주소>/api/chat` 입니다.

## 3. DataLens 배포에 연결(DataLens Vercel 주인)

DataLens 프로젝트 → Settings → Environment Variables(Production)에 두 개를 넣고 **Redeploy**:

| 이름 | 값 |
| --- | --- |
| `LLM_RELAY_URL` | `https://<중계 주소>/api/chat` |
| `LLM_RELAY_TOKEN` | 1번의 출입증 (Sensitive) |

넣은 뒤 올리는 파일부터 AI가 민원을 읽고 카테고리를 만들어 분류합니다. 두 값을 지우면 이전처럼 AI 없이 동작합니다.

## 개발

```bash
npm install
npm run typecheck
npm test
```
