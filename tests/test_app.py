"""
tests/test_app.py
Automated test suite for CodeBuddy AI Flask API routes, validation,
Google Gemma 4 features (generation, explanation, debugging, optimization),
follow-up chat with history, and smart demo mode responses.
"""

import json
import pytest
from app import create_app

@pytest.fixture
def client():
    """Configures test client for Flask application."""
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_index_route(client):
    """Test that main landing and studio page loads successfully."""
    response = client.get("/")
    assert response.status_code == 200
    assert b"CodeBuddy" in response.data
    assert b"Gemma 4" in response.data or b"Beginner Mentor" in response.data

def test_health_check_endpoint(client):
    """Test health check route returns operational status, provider, and schema."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "healthy"
    assert "supported_languages" in data
    assert "python" in data["supported_languages"]
    assert "supported_modes" in data
    assert "explain" in data["supported_modes"]
    assert "generate" in data["supported_modes"]
    assert "provider" in data

def test_samples_endpoint(client):
    """Test sample code snippets for all supported beginner languages."""
    response = client.get("/api/samples")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    samples = data["samples"]
    for lang in ["python", "javascript", "java", "c", "cpp"]:
        assert lang in samples
        assert "title" in samples[lang]
        assert "code" in samples[lang]
        assert len(samples[lang]["code"]) > 10

def test_analyze_empty_payload(client):
    """Test analyzing with empty payload fails validation."""
    response = client.post("/api/analyze", json={})
    assert response.status_code == 400
    data = response.get_json()
    assert data["status"] == "error"

def test_analyze_empty_code(client):
    """Test analyzing whitespace code returns 400 validation error."""
    response = client.post("/api/analyze", json={
        "code": "   \n  \t  ",
        "language": "python",
        "mode": "explain"
    })
    assert response.status_code == 400
    data = response.get_json()
    assert "Please enter or paste your code snippet" in data["message"]

def test_analyze_unsupported_language(client):
    """Test analyzing with an invalid language returns 400."""
    response = client.post("/api/analyze", json={
        "code": "print('hello')",
        "language": "ruby",
        "mode": "explain"
    })
    assert response.status_code == 400
    data = response.get_json()
    assert "Invalid language" in data["message"]

def test_analyze_unsupported_mode(client):
    """Test analyzing with an invalid mode returns 400."""
    response = client.post("/api/analyze", json={
        "code": "print('hello')",
        "language": "python",
        "mode": "hack_the_planet"
    })
    assert response.status_code == 400
    data = response.get_json()
    assert "Invalid mode" in data["message"]

def test_analyze_oversized_code(client):
    """Test that submitting code over 15k characters is rejected."""
    huge_code = "# test\n" * 3000
    response = client.post("/api/analyze", json={
        "code": huge_code,
        "language": "python",
        "mode": "explain"
    })
    assert response.status_code == 400
    data = response.get_json()
    assert "15,000 characters limit" in data["message"]

def test_analyze_non_json_request(client):
    """Test sending non-JSON payload returns 400."""
    response = client.post("/api/analyze", data="plain text data")
    assert response.status_code == 400

@pytest.mark.parametrize("mode", ["explain", "bugs", "improve", "generate", "tests", "learn"])
def test_analyze_all_modes(client, mode):
    """Test that all 6 modes (including generate) respond successfully with proper structure."""
    sample_code = "def add(a, b):\n    return a + b\n"
    response = client.post("/api/analyze", json={
        "code": sample_code,
        "language": "python",
        "mode": mode
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    res_data = data["data"]
    assert res_data["mode"] == mode
    if mode == "generate":
        assert "generated_code" in res_data
    else:
        assert "summary" in res_data or "primary_concept" in res_data or "status" in res_data

@pytest.mark.parametrize("lang", ["python", "javascript", "java", "c", "cpp"])
def test_analyze_all_languages(client, lang):
    """Test that all 5 programming languages are supported."""
    sample_code = "int x = 42;"
    response = client.post("/api/analyze", json={
        "code": sample_code,
        "language": lang,
        "mode": "explain"
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert data["data"]["language"] == lang

def test_chat_followup_success(client):
    """Test follow-up chat endpoint returns conversational mentor reply."""
    response = client.post("/api/chat", json={
        "message": "Can you explain why we check for empty input?",
        "code": "def double(nums):\n    if not nums: return []\n    return [x*2 for x in nums]",
        "language": "python",
        "history": [
            {"role": "user", "content": "What does this code do?"},
            {"role": "model", "content": "This function doubles every number in a list."}
        ]
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "success"
    assert "reply" in data["data"]
    assert len(data["data"]["reply"]) > 5

def test_chat_followup_empty_message(client):
    """Test follow-up chat with empty message fails validation."""
    response = client.post("/api/chat", json={
        "message": "   ",
        "code": "print(1)",
        "language": "python"
    })
    assert response.status_code == 400
    data = response.get_json()
    assert data["status"] == "error"
    assert "Message cannot be empty" in data["message"]
