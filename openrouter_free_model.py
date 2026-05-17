import os

import httpx
from openai import OpenAI


params = {
    "active": True,
    "fmt": "cards",
    "max_price": 0,
    "categories": "tool",
    "input_modalities": "text",
}

# Get available translation models
with httpx.Client() as http_client:
    resp = http_client.get(
        "https://openrouter.ai/api/frontend/models/find",
        params=params,
    ).json()

print("Available translation models:")
models = resp.get("data", {})
model_list = []
for model in models.get("models", []):
    id = model['endpoint']['model_variant_slug']
    print(f"  - {id}: {model.get('name', 'N/A')}")
    model_list.append(f"{id}")

pass
