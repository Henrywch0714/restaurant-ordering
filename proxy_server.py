#!/usr/bin/env python3
"""
Simple proxy server to handle Qwen API requests and avoid CORS issues
Run this server alongside your main application
"""

from flask import Flask, request, jsonify
import requests
import os

app = Flask(__name__)

# Manual CORS handling (no flask-cors needed)
@app.after_request
def after_request(response):
    # Use set() instead of add() to avoid duplicates
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response

# Qwen API configuration
# Use environment variable if available, otherwise use default
QWEN_API_KEY = os.environ.get('QWEN_API_KEY', 'sk-ca0f66aeb99342bf9873e58007f0e829')
QWEN_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'

@app.route('/api/qwen', methods=['POST', 'OPTIONS'])
def qwen_proxy():
    """Proxy endpoint for Qwen API requests"""
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        # CORS headers are already added by @app.after_request, don't add again
        return jsonify({}), 200
    
    try:
        # Get request data
        data = request.json
        
        # Forward request to Qwen API
        response = requests.post(
            QWEN_ENDPOINT,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {QWEN_API_KEY}',
                'X-DashScope-SSE': 'disable'
            },
            json=data,
            timeout=30
        )
        
        # Return response
        return jsonify(response.json()), response.status_code
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            'error': 'API request failed',
            'message': str(e)
        }), 500
    except Exception as e:
        return jsonify({
            'error': 'Server error',
            'message': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    # Get port from environment variable (for cloud deployment) or use default
    port = int(os.environ.get('PORT', 5000))
    
    print('🚀 Starting Qwen API Proxy Server...')
    print(f'📍 Server running on http://0.0.0.0:{port}')
    print(f'📡 Proxy endpoint: http://0.0.0.0:{port}/api/qwen')
    print('✅ Ready to handle API requests!')
    app.run(host='0.0.0.0', port=port, debug=False)

