#!/usr/bin/env python3
"""
Send a message to an ntfy service.
"""

import sys
import json
import argparse
import requests

def send_ntfy_message(message, title="OpenClaw Message", priority="default", topic="openclaw_in2"):
    """
    Send a message to the ntfy service.

    Args:
        message: The message content to send
        title: Message title (default: "OpenClaw Message")
        priority: Priority level - "low", "default", "high" (default: "default")
        topic: Topic/path (default: "openclaw_in2")

    Returns:
        dict: Response from ntfy server or error information
    """
    # ntfy endpoint
    url = f"http://118.89.62.149:8090/{topic.lstrip('/')}"

    # Map priority to ntfy numeric values
    priority_map = {
        "low": 0,
        "default": 3,
        "high": 4
    }
    priority_num = priority_map.get(priority, 3)

    headers = {
        "Title": title,
        "Priority": str(priority_num)
    }

    try:
        response = requests.post(url, data=message.encode('utf-8'), headers=headers, timeout=10)
        response.raise_for_status()

        # Try to parse JSON response
        try:
            return {"success": True, "data": response.json()}
        except json.JSONDecodeError:
            return {"success": True, "data": response.text, "raw": True}

    except requests.exceptions.RequestException as e:
        return {"success": False, "error": str(e), "url": url}

def main():
    parser = argparse.ArgumentParser(description="Send a message to ntfy service")
    parser.add_argument("message", help="Message content to send")
    parser.add_argument("--title", default="OpenClaw Message", help="Message title")
    parser.add_argument("--priority", default="default", choices=["low", "default", "high"], help="Message priority")
    parser.add_argument("--topic", default="openclaw_in2", help="Topic/path")

    args = parser.parse_args()
    result = send_ntfy_message(args.message, args.title, args.priority, args.topic)

    if result["success"]:
        print(f"✅ Message sent successfully")
        if isinstance(result["data"], dict):
            print(f"Message ID: {result['data'].get('id', 'N/A')}")
            print(f"Time: {result['data'].get('time', 'N/A')}")
        else:
            print(f"Response: {result['data']}")
        sys.exit(0)
    else:
        print(f"❌ Failed to send message: {result['error']}")
        sys.exit(1)

if __name__ == "__main__":
    main()
