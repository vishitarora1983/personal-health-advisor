#!/usr/bin/env python3
"""Generate or edit images using OpenRouter's image generation models."""

import argparse
import base64
import json
import os
import sys
import mimetypes

try:
    import requests
except ImportError:
    print("Error: 'requests' library is required. Install it with: pip install requests")
    sys.exit(1)


def load_env(env_path=None):
    """Load environment variables from .env file."""
    paths_to_try = []
    if env_path:
        paths_to_try.append(env_path)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    paths_to_try.extend([
        os.path.join(script_dir, ".env"),
        os.path.join(script_dir, "..", ".env"),
        os.path.join(script_dir, "..", "backend", ".env"),
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.getcwd(), "backend", ".env"),
    ])

    for path in paths_to_try:
        path = os.path.abspath(path)
        if os.path.exists(path):
            with open(path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, _, value = line.partition("=")
                        key = key.strip()
                        value = value.strip()
                        if not os.environ.get(key):
                            os.environ[key] = value


def generate_image(prompt, model="google/gemini-3-pro-image-preview", api_key=None,
                   output="generated_image.png", input_image=None):
    """Generate or edit an image using OpenRouter API."""
    if not api_key:
        api_key = os.environ.get("OPENROUTER_API_KEY")

    if not api_key:
        print("Error: OPENROUTER_API_KEY not found.")
        sys.exit(1)

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    if input_image:
        mime_type, _ = mimetypes.guess_type(input_image)
        if mime_type is None:
            mime_type = "image/png"
        with open(input_image, "rb") as f:
            image_data = f.read()
        b64 = base64.b64encode(image_data).decode("utf-8")
        data_url = f"data:{mime_type};base64,{b64}"
        content = [
            {"type": "image_url", "image_url": {"url": data_url}},
            {"type": "text", "text": prompt},
        ]
    else:
        content = [{"type": "text", "text": prompt}]

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
    }

    if "gemini" in model.lower():
        payload["modalities"] = ["text", "image"]

    print(f"Model: {model}")
    print(f"Prompt: {prompt}")
    if input_image:
        print(f"Input image: {input_image}")
    print("Generating image...")

    response = requests.post(url, headers=headers, json=payload, timeout=120)

    if response.status_code != 200:
        print(f"Error: API returned status {response.status_code}")
        print(response.text)
        sys.exit(1)

    data = response.json()
    image_saved = False

    if "choices" in data:
        for choice in data["choices"]:
            message = choice.get("message", {})
            content_resp = message.get("content", "")

            # Check message.images (FLUX models put images here)
            msg_images = message.get("images", [])
            if msg_images and isinstance(msg_images, list):
                for img_item in msg_images:
                    if isinstance(img_item, dict):
                        img_url = img_item.get("image_url", {}).get("url", "")
                        if not img_url:
                            img_url = img_item.get("url", "")
                        if img_url and img_url.startswith("data:"):
                            _, b64data = img_url.split(",", 1)
                            img_data = base64.b64decode(b64data)
                            os.makedirs(os.path.dirname(os.path.abspath(output)) or ".", exist_ok=True)
                            with open(output, "wb") as f:
                                f.write(img_data)
                            image_saved = True
                            break
                if image_saved:
                    break

            if isinstance(content_resp, list):
                for part in content_resp:
                    if isinstance(part, dict):
                        if "inline_data" in part:
                            inline = part["inline_data"]
                            img_data = base64.b64decode(inline["data"])
                            os.makedirs(os.path.dirname(os.path.abspath(output)) or ".", exist_ok=True)
                            with open(output, "wb") as f:
                                f.write(img_data)
                            image_saved = True
                            break
                        if part.get("type") == "image_url":
                            url_data = part.get("image_url", {}).get("url", "")
                            if url_data.startswith("data:"):
                                _, b64data = url_data.split(",", 1)
                                img_data = base64.b64decode(b64data)
                                os.makedirs(os.path.dirname(os.path.abspath(output)) or ".", exist_ok=True)
                                with open(output, "wb") as f:
                                    f.write(img_data)
                                image_saved = True
                                break
            if image_saved:
                break

    if not image_saved and "images" in data:
        for img in data["images"]:
            if isinstance(img, dict) and "url" in img:
                url_data = img["url"]
                if url_data.startswith("data:"):
                    _, b64data = url_data.split(",", 1)
                    img_data = base64.b64decode(b64data)
                elif url_data.startswith("http"):
                    img_data = requests.get(url_data, timeout=60).content
                else:
                    img_data = base64.b64decode(url_data)
                os.makedirs(os.path.dirname(os.path.abspath(output)) or ".", exist_ok=True)
                with open(output, "wb") as f:
                    f.write(img_data)
                image_saved = True
                break
            elif isinstance(img, str):
                if img.startswith("data:"):
                    _, b64data = img.split(",", 1)
                    img_data = base64.b64decode(b64data)
                else:
                    img_data = base64.b64decode(img)
                os.makedirs(os.path.dirname(os.path.abspath(output)) or ".", exist_ok=True)
                with open(output, "wb") as f:
                    f.write(img_data)
                image_saved = True
                break

    if image_saved:
        file_size = os.path.getsize(output)
        print(f"Image saved to: {output} ({file_size:,} bytes)")
    else:
        print("Warning: Could not extract image from response.")
        print("Full response (truncated):")
        raw = json.dumps(data, indent=2, default=str)
        # Truncate any base64 strings for readability
        print(raw[:5000])
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Generate or edit images using OpenRouter API")
    parser.add_argument("prompt", help="Text description or editing instructions")
    parser.add_argument("--input", "-i", help="Input image path for editing")
    parser.add_argument("--model", "-m", default="google/gemini-3-pro-image-preview",
                        help="OpenRouter model ID (default: google/gemini-3-pro-image-preview)")
    parser.add_argument("--output", "-o", default="generated_image.png",
                        help="Output file path (default: generated_image.png)")
    parser.add_argument("--api-key", help="OpenRouter API key (overrides .env)")

    args = parser.parse_args()
    load_env()
    generate_image(
        prompt=args.prompt,
        model=args.model,
        api_key=args.api_key,
        output=args.output,
        input_image=args.input,
    )


if __name__ == "__main__":
    main()
