# Upload Route Postman Checklist

Use this file for upload:

- [sample-upload.txt](/c:/Users/HP/Desktop/Agentic-AI/day-07/sample-upload.txt)

## Before testing

1. Stop any old `day-07` server process.
2. Start fresh:

```bash
cd day-07
npm run start
```

3. Login or register first and copy the JWT token.

## Exact Postman setup

Request:

```text
POST http://localhost:3000/api/documents/upload
```

Headers:

```text
Authorization: Bearer YOUR_TOKEN
```

Do not manually add:

```text
Content-Type: multipart/form-data
```

Let Postman generate it automatically.

Body:

1. Open `Body`
2. Select `form-data`
3. Add one row only
4. In `Key`, type exactly: `file`
5. Change the row type from `Text` to `File`
6. In `Value`, click `Select files`
7. Choose [sample-upload.txt](/c:/Users/HP/Desktop/Agentic-AI/day-07/sample-upload.txt)
8. Make sure the checkbox for that row is enabled

## What success looks like

Expected status:

```text
201 Created
```

Expected response shape:

```json
{
  "success": true,
  "message": "Document uploaded and processed successfully.",
  "data": {
    "id": "...",
    "originalName": "sample-upload.txt",
    "mimeType": "text/plain",
    "fileSizeBytes": 167,
    "pageCount": null,
    "wordCount": 21,
    "estimatedTokenCount": 42
  }
}
```

## If you still get "No file uploaded"

Check these one by one:

1. The row key is exactly `file`
2. The row type is `File`, not `Text`
3. The value is an actual chosen file, not `Select files`
4. The row checkbox is enabled
5. You did not manually set `Content-Type`
6. You are calling:

```text
POST /api/documents/upload
```

7. The token is valid

## If you get unsupported file type

Allowed types are:

- `.txt`
- `.md`
- `.pdf`

## Quick next tests after upload

1. `GET /api/documents`
2. `GET /api/documents/{{document_id}}`
3. `POST /api/documents/{{document_id}}/chat`
4. `POST /api/documents/{{document_id}}/summarize`
5. `DELETE /api/documents/{{document_id}}`
