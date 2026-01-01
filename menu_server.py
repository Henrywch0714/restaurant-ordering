#!/usr/bin/env python3
"""
Backend server for restaurant ordering system
- Handles Qwen API proxy (for chatbot)
- Serves menu data from MongoDB
"""

from flask import Flask, request, jsonify
import requests
import os
from pymongo import MongoClient
from bson import ObjectId
import json

app = Flask(__name__)

# Manual CORS handling
@app.after_request
def after_request(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,Cache-Control,Pragma'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    return response

# MongoDB Configuration
# You can set your connection string here directly, or use environment variable
# Option 1: Set directly in code (easier for local development)
MONGODB_URI_DEFAULT = 'mongodb+srv://wch2701877132_db_user:DISHORDERWCH@dishes.hfs6i6e.mongodb.net/restaurant_db?retryWrites=true&w=majority'

# Option 2: Use environment variable (for production/cloud deployment)
MONGODB_URI = os.environ.get('MONGODB_URI', MONGODB_URI_DEFAULT)
DATABASE_NAME = os.environ.get('DATABASE_NAME', 'restaurant_db')
COLLECTION_NAME = os.environ.get('COLLECTION_NAME', 'dishes')

# Initialize MongoDB connection
try:
    client = MongoClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    dishes_collection = db[COLLECTION_NAME]
    print('✅ Connected to MongoDB')
except Exception as e:
    print(f'⚠️ MongoDB connection error: {e}')
    print('⚠️ Make sure MongoDB is running or MONGODB_URI is set correctly')
    dishes_collection = None

# Qwen API configuration
QWEN_API_KEY = os.environ.get('QWEN_API_KEY', 'sk-ca0f66aeb99342bf9873e58007f0e829')
QWEN_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'

# Helper function to convert ObjectId to string
def serialize_dish(dish):
    """Convert MongoDB document to JSON-serializable format"""
    if dish is None:
        return None
    dish['id'] = str(dish['_id'])
    del dish['_id']
    return dish

# ==================== MENU API ENDPOINTS ====================

@app.route('/api/menu', methods=['GET', 'OPTIONS'])
def get_menu():
    """Get all menu items from MongoDB"""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    if dishes_collection is None:
        return jsonify({
            'error': 'Database not connected',
            'message': 'MongoDB connection failed. Please check your connection string.'
        }), 500
    
    try:
        # Get optional query parameters
        category = request.args.get('category', None)
        
        # Build query
        query = {}
        if category and category != 'all':
            query['category'] = category
        
        # Fetch dishes from MongoDB
        dishes = list(dishes_collection.find(query).sort('id', 1))
        
        # Convert ObjectId to string
        dishes = [serialize_dish(dish) for dish in dishes]
        
        # Create response with no-cache headers to prevent browser caching
        response = jsonify({
            'success': True,
            'count': len(dishes),
            'dishes': dishes
        })
        
        # Add cache-control headers to prevent caching
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        return response, 200
        
    except Exception as e:
        return jsonify({
            'error': 'Database error',
            'message': str(e)
        }), 500

@app.route('/api/menu/<dish_id>', methods=['GET', 'OPTIONS'])
def get_dish(dish_id):
    """Get a single dish by ID"""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    if dishes_collection is None:
        return jsonify({
            'error': 'Database not connected'
        }), 500
    
    try:
        # Try to find by ObjectId first, then by id field
        dish = None
        try:
            dish = dishes_collection.find_one({'_id': ObjectId(dish_id)})
        except:
            pass
        
        if not dish:
            dish = dishes_collection.find_one({'id': int(dish_id)})
        
        if not dish:
            return jsonify({
                'error': 'Dish not found'
            }), 404
        
        return jsonify({
            'success': True,
            'dish': serialize_dish(dish)
        }), 200
        
    except Exception as e:
        return jsonify({
            'error': 'Database error',
            'message': str(e)
        }), 500

@app.route('/api/menu', methods=['POST', 'OPTIONS'])
def create_dish():
    """Create a new dish in MongoDB"""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    if dishes_collection is None:
        return jsonify({
            'error': 'Database not connected'
        }), 500
    
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['name', 'description', 'price', 'category']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'error': f'Missing required field: {field}'
                }), 400
        
        # Insert into MongoDB
        result = dishes_collection.insert_one(data)
        
        return jsonify({
            'success': True,
            'message': 'Dish created successfully',
            'id': str(result.inserted_id)
        }), 201
        
    except Exception as e:
        return jsonify({
            'error': 'Database error',
            'message': str(e)
        }), 500

@app.route('/api/menu/<dish_id>', methods=['PUT', 'OPTIONS'])
def update_dish(dish_id):
    """Update a dish in MongoDB"""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    if dishes_collection is None:
        return jsonify({
            'error': 'Database not connected'
        }), 500
    
    try:
        data = request.json
        
        # Try to find by ObjectId first, then by id field
        query = {}
        try:
            query = {'_id': ObjectId(dish_id)}
        except:
            query = {'id': int(dish_id)}
        
        # Update dish
        result = dishes_collection.update_one(query, {'$set': data})
        
        if result.matched_count == 0:
            return jsonify({
                'error': 'Dish not found'
            }), 404
        
        return jsonify({
            'success': True,
            'message': 'Dish updated successfully'
        }), 200
        
    except Exception as e:
        return jsonify({
            'error': 'Database error',
            'message': str(e)
        }), 500

@app.route('/api/menu/<dish_id>', methods=['DELETE', 'OPTIONS'])
def delete_dish(dish_id):
    """Delete a dish from MongoDB"""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    if dishes_collection is None:
        return jsonify({
            'error': 'Database not connected'
        }), 500
    
    try:
        # Try to find by ObjectId first, then by id field
        query = {}
        try:
            query = {'_id': ObjectId(dish_id)}
        except:
            query = {'id': int(dish_id)}
        
        result = dishes_collection.delete_one(query)
        
        if result.deleted_count == 0:
            return jsonify({
                'error': 'Dish not found'
            }), 404
        
        return jsonify({
            'success': True,
            'message': 'Dish deleted successfully'
        }), 200
        
    except Exception as e:
        return jsonify({
            'error': 'Database error',
            'message': str(e)
        }), 500

# ==================== QWEN API PROXY ====================

@app.route('/api/qwen', methods=['POST', 'OPTIONS'])
def qwen_proxy():
    """Proxy endpoint for Qwen API requests"""
    
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    
    try:
        data = request.json
        
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

# ==================== HEALTH CHECK ====================

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    db_status = 'connected' if dishes_collection is not None else 'disconnected'
    return jsonify({
        'status': 'ok',
        'database': db_status
    }), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    
    print('🚀 Starting Restaurant API Server...')
    print(f'📍 Server running on http://0.0.0.0:{port}')
    print(f'📡 Menu API: http://0.0.0.0:{port}/api/menu')
    print(f'📡 Qwen Proxy: http://0.0.0.0:{port}/api/qwen')
    print('✅ Ready to handle requests!')
    app.run(host='0.0.0.0', port=port, debug=False)

