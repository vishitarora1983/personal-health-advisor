#!/usr/bin/env python3
"""Generate an image using OpenAI DALL-E 3 API."""

import argparse
import base64
import os
import sys
import urllib.request
import json


def main():
    parser = argparse.ArgumentParser(description="Generate an image using OpenAI DALL-E 3")
    parser.add_argument("prompt", help="Text description of the image to generate")
    parser.add_argument("--output", "-o", default="generated_image.png", help="Output file path")
    parser.add_argument("--size", "-s", default="1024x1024",
                        choices=["1024x1024", "1792x1024", "1024x1792"],
                        help="Image size")
    parser.add_argument("--api-key", help="OpenAI API key (overrides env var)")
    args = parser.parse_args()

    api_key = args.api_key or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: No OpenAI API key found. Set OPENAI_API_KEY or pass --api-key.")
        sys.exit(1)

    print(f"Generating image with DALL-E 3...")
    print(f"Prompt: {args.prompt}")
    print(f"Size: {args.size}")

    # Build request
    url = "https://api.openai.com/v1/images/generations"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    data = json.dumps({
        "model": "dall-e-3",
        "prompt": args.prompt,
        "n": 1,
        "size": args.size,
        "response_format": "b64_json",
    }).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        print(f"API Error {e.code}: {error_body}")
        sys.exit(1)

    # Extract base64 image data
    b64_data = body["data"][0]["b64_json"]
    revised_prompt = body["data"][0].get("revised_prompt", "")

    # Ensure output directory exists
    out_dir = os.path.dirname(args.output)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    # Save image
    with open(args.output, "wb") as f:
        f.write(base64.b64decode(b64_data))

    print(f"Image saved to: {args.output}")
    if revised_prompt:
        print(f"Revised prompt: {revised_prompt}")


if __name__ == "__main__":
    main()
