import os
import json
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("ANTHROPIC_API_KEY")
if not api_key:
    raise ValueError("ANTHROPIC_API_KEY not found in environment variables. Please set it in your .env file.")

try:
    anthropic = Anthropic(api_key=api_key)
except Exception as e:
    raise ValueError(f"Failed to initialize Anthropic client: {e}")


def analyze_with_anthropic(page_data):
    system_prompt = """You are an expert analyst. Your task is to review structured JSON data from a webpage.
Summarize the strengths and weaknesses of this page in terms of SEO, accessibility, and semantic HTML structure.
Provide specific, actionable suggestions for improvements.
Structure your response clearly, using Markdown for headings (e.g., ## Strengths, ## Weaknesses, ## Suggestions)."""

    user_message_content = f"""
Here is a structured JSON of a webpage:

{json.dumps(page_data, indent=2)}

Please analyze it based on the instructions provided.
"""

    try:
        response = anthropic.messages.create(
            model="claude-3-7-sonnet-20250219",
            max_tokens=1500,
            temperature=0.5,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": user_message_content
                }
            ]
        )
        if response.content and len(response.content) > 0:
            return response.content[0].text.strip()
        else:
            return "No content returned from API."

    except Exception as e:
        error_message = f"Anthropic API error: {e}"
        print(error_message)
        if hasattr(e, 'response') and hasattr(e.response, 'json'):
            try:
                error_details = e.response.json()
                error_message += f" | Details: {json.dumps(error_details)}"
            except json.JSONDecodeError:
                error_message += f" | Details: (Could not decode JSON error response from API)"


        raise Exception(error_message)