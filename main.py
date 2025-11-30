#python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
#python -m http.server 3000
from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
import requests
from pypdf import PdfReader
import docx
import os
from io import BytesIO
from dotenv import load_dotenv

# ---------- LOAD ENV VARIABLES ----------
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# ---------- SETUP ----------
app = FastAPI()

# Allow frontend access - CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (or specify your Vercel URL)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- HELPERS ----------
def extract_text_from_pdf(file_bytes: bytes):
    """Extract readable text from a PDF."""
    text = ""
    try:
        pdf = PdfReader(BytesIO(file_bytes))
        for page in pdf.pages:
            text += page.extract_text() + "\n"
    except Exception as e:
        print(f"PDF extraction error: {e}")
        text = "Error reading PDF file"
    return text


def extract_text_from_docx(file_bytes: bytes):
    """Extract readable text from a DOCX."""
    try:
        doc = docx.Document(BytesIO(file_bytes))
        return "\n".join([p.text for p in doc.paragraphs])
    except Exception as e:
        print(f"DOCX extraction error: {e}")
        return "Error reading DOCX file"


# ---------- ROUTES ----------

@app.get("/")
def home():
    return {"message": "✅ FastAPI backend is running!"}


@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    """Receive uploaded document and extract readable text."""
    contents = await file.read()
    text = ""

    if file.filename.lower().endswith(".pdf"):
        text = extract_text_from_pdf(contents)
    elif file.filename.lower().endswith(".docx"):
        text = extract_text_from_docx(contents)
    else:
        text = contents.decode("utf-8", errors="ignore")

    return {"filename": file.filename, "content": text}


@app.post("/api/ask")
async def ask_ai(request: Request):
    """Handle Q&A about uploaded documents."""
    data = await request.json()
    question = data.get("question")
    document = data.get("document")

    if not OPENAI_API_KEY:
        return {"error": "API key not found on server."}

    print(f"🔑 API Key (first 10 chars): {OPENAI_API_KEY[:10]}...")
    print(f"📝 Question: {question[:50]}...")

    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a helpful study assistant. Base your answers only on the given document content.",
                    },
                    {
                        "role": "user",
                        "content": f"Document:\n{document[:4000]}\n\nQuestion: {question}",
                    },
                ],
                "max_tokens": 500,
            },
            timeout=30
        )

        print(f"📡 OpenAI Response Status: {response.status_code}")
        
        if response.status_code != 200:
            error_detail = response.json() if response.text else response.text
            print(f"❌ Error Details: {error_detail}")
            return {"error": f"OpenAI API Error (Status {response.status_code})", "details": error_detail}

        return response.json()
    except requests.exceptions.Timeout:
        print("⏱️ Request timeout")
        return {"error": "Request timed out. Please try again."}
    except requests.exceptions.ConnectionError:
        print("🌐 Connection error")
        return {"error": "Cannot connect to OpenAI. Check your internet connection."}
    except Exception as e:
        print(f"💥 Exception: {type(e).__name__}: {str(e)}")
        return {"error": f"{type(e).__name__}: {str(e)}"}


@app.post("/api/flashcards")
async def generate_flashcards(request: Request):
    """Generate flashcards from document content."""
    data = await request.json()
    document = data.get("document")
    count = data.get("count", 10)

    if not OPENAI_API_KEY:
        return {"error": "API key not found on server."}

    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a flashcard generator. Create flashcards in JSON format with question and answer keys.",
                    },
                    {
                        "role": "user",
                        "content": f'Create {count} flashcards from this text:\n{document[:4000]}\n\nReturn ONLY a JSON array like: [{{"question": "...", "answer": "..."}}]',
                    },
                ],
                "max_tokens": 1500,
            },
            timeout=30
        )

        if response.status_code != 200:
            return {"error": "Failed to generate flashcards", "details": response.text}

        return response.json()
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/notes")
async def generate_notes(request: Request):
    """Generate study notes from document."""
    data = await request.json()
    document = data.get("document")

    if not OPENAI_API_KEY:
        return {"error": "API key not found on server."}

    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a study notes generator. Create clear, concise, bullet-pointed notes from the given content.",
                    },
                    {
                        "role": "user",
                        "content": f"Document:\n{document[:4000]}",
                    },
                ],
                "max_tokens": 1500,
            },
            timeout=30
        )

        if response.status_code != 200:
            return {"error": "Failed to generate notes", "details": response.text}

        return response.json()
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/analyze-papers")
async def analyze_question_papers(request: Request):
    """Analyze multiple question papers and predict trends."""
    data = await request.json()
    documents = data.get("documents", [])

    if not documents:
        return {"error": "No question papers provided."}

    if not OPENAI_API_KEY:
        return {"error": "API key not found on server."}

    combined_text = "\n\n".join([d[:4000] for d in documents])

    prompt = f"""
    You are an expert exam analyst AI. Analyze the following question papers.

    Tasks:
    1. Identify frequently repeated questions or question types.
    2. List the most important and commonly asked topics.
    3. Predict which topics or question types might appear in the next exam.
    4. Provide a summary of the exam trend (difficulty, focus areas, etc.).
    5. Finally, suggest a 7-day focused study plan based on this analysis.

    Question Papers:
    {combined_text}
    """

    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": "You are a professional exam analysis assistant."},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 1500
            },
            timeout=60
        )

        if response.status_code != 200:
            return {"error": "Failed to analyze papers", "details": response.text}

        data = response.json()
        analysis = data["choices"][0]["message"]["content"]

        return {"analysis": analysis}
    except Exception as e:
        return {"error": str(e)}