# Day-04 Application - Testing Report

## Issues Found & Fixed

### ✅ Issue 1: Incorrect Static File Path
**Problem**: The app was looking for `public/` directory in the root, but it's located at `src/public/`
- **File**: `src/app.js` (line 12)
- **Original**: `app.use(express.static('public'));`
- **Fixed**: `app.use(express.static('src/public'));`

### ✅ Issue 2: Client-Side Environment Variable Reference
**Problem**: HTML client was referencing `process.env.AI_PROVIDER` which doesn't exist on client side
- **File**: `src/public/test-client.html` (line 87)
- **Original**: `statusDiv.textContent = \`Streaming... (${process.env.AI_PROVIDER || 'AI'})\`;`
- **Fixed**: `statusDiv.textContent = \`Streaming...\`;`

## Application Status
✅ **All issues resolved**

## How to Run & Test

### 1. **Start the Server**
```powershell
cd c:\Users\HP\Desktop\Agentic-AI\day-04
npm install  # If not already installed
npm start
```

Expected output:
```
🚀 Server: http://localhost:3000
🤖 Provider: gemini
🧪 Test UI: http://localhost:3000/test-client.html
```

### 2. **Health Check Endpoint**
```powershell
Invoke-WebRequest -Uri http://localhost:3000/health -Method GET
```

Response:
```json
{"status":"ok","provider":"gemini"}
```

### 3. **Test Streaming Chat API (PowerShell)**
```powershell
$body = @{ message = "Hello, what is AI?" } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:3000/api/chat/stream -Method POST `
  -Headers @{'Content-Type'='application/json'} -Body $body | Select-Object -ExpandProperty Content
```

### 4. **Test Input Validation (Short Message)**
```powershell
$body = @{ message = "a" } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:3000/api/chat/stream -Method POST `
  -Headers @{'Content-Type'='application/json'} -Body $body -ErrorAction SilentlyContinue
```

### 5. **Test Using Web Browser**
Open: `http://localhost:3000/test-client.html`

Features:
- Type a message in the textarea
- Click "Send Message" or press Enter
- Watch the AI response stream in real-time
- Shows response time and character count

### 6. **Test with cURL (from WSL or Git Bash)**
```bash
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Explain JavaScript event loop"}'
```

## Configuration

**.env file** (already set up):
```
GEMINI_API_KEY=AIzaSyB4o4mRMeodWDM_Ubiw21rWTnvKTWGsq3E
AI_PROVIDER=gemini          # switch to "ollama" for local
PORT=3000
```

**Switch to Ollama Provider** (if Ollama is installed locally):
1. Change `.env`: `AI_PROVIDER=ollama`
2. Run: `ollama serve` in another terminal
3. Restart the app

## API Endpoints

### POST `/api/chat/stream`
Streams AI response in Server-Sent Events (SSE) format

**Request**:
```json
{
  "message": "Your question here",
  "context": "Optional context (not used yet)"
}
```

**Response** (SSE stream):
```
data: {"chunk":"Response text","type":"chunk"}
data: {"chunk":" more text","type":"chunk"}
data: {"type":"done","totalChars":269}
```

**Validation**:
- Message required
- Message must be 2-1000 characters
- Returns 400 Bad Request on validation failure

### GET `/health`
Health check endpoint

**Response**:
```json
{"status":"ok","provider":"gemini"}
```

## Testing Checklist
- ✅ Server starts without errors
- ✅ Health endpoint responds (200 OK)
- ✅ Streaming chat API works with Gemini
- ✅ Input validation works (min/max length)
- ✅ Static files served correctly
- ✅ HTML client loads and works
- ✅ Error handling works
- ✅ SSE streaming format is correct

## Development Commands

```powershell
# Start with file watcher (auto-restart on changes)
npm run dev

# Just run once
npm start
```

## Notes
- The application uses **Gemini 2.5 Flash** by default
- Supports **Ollama** as alternative provider (set in `.env`)
- Client-side streaming handled with `ReadableStream` API
- Server-sent events (SSE) used for real-time updates
- All input validated server-side
