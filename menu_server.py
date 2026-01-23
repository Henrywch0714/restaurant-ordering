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
    # Allow all origins (for GitHub Pages and localhost)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,Cache-Control,Pragma'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Credentials'] = 'false'
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
EMBEDDINGS_API_KEY = os.environ.get('EMBEDDINGS_API_KEY', QWEN_API_KEY)
EMBEDDINGS_ENDPOINT = os.environ.get(
    'EMBEDDINGS_ENDPOINT',
    'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding'
)
EMBEDDINGS_MODEL = os.environ.get('EMBEDDINGS_MODEL', 'text-embedding-v1')

# Translation API configuration (optional)
TRANSLATE_PROVIDER = os.environ.get('TRANSLATE_PROVIDER', 'libre').lower()
TRANSLATE_ENDPOINT = os.environ.get('TRANSLATE_ENDPOINT', 'https://libretranslate.com/translate')
TRANSLATE_API_KEY = os.environ.get('TRANSLATE_API_KEY', '')
GOOGLE_TRANSLATE_ENDPOINT = os.environ.get(
    'GOOGLE_TRANSLATE_ENDPOINT',
    'https://translation.googleapis.com/language/translate/v2'
)
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', '')

def translate_texts_internal(texts, target, source='en'):
    payload = {
        'q': texts,
        'source': source,
        'target': target,
        'format': 'text'
    }
    if TRANSLATE_API_KEY:
        payload['api_key'] = TRANSLATE_API_KEY

    if TRANSLATE_PROVIDER == 'google':
        if not GOOGLE_API_KEY:
            raise ValueError('GOOGLE_API_KEY is not set')
        
        # Google Translate API v2 format
        # Note: texts should be a list, and we need to handle both single and multiple texts
        if not isinstance(texts, list):
            texts = [texts]
        
        try:
            response = requests.post(
                GOOGLE_TRANSLATE_ENDPOINT,
                params={'key': GOOGLE_API_KEY},
                json={
                    'q': texts,
                    'source': source,
                    'target': target,
                    'format': 'text'
                },
                timeout=60
            )
            
            if not response.ok:
                error_text = response.text
                print(f'❌ Google Translate API error {response.status_code}: {error_text}')
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error', {}).get('message', error_text)
                    raise ValueError(f'Google Translate error {response.status_code}: {error_msg}')
                except:
                    raise ValueError(f'Google Translate error {response.status_code}: {error_text}')
            
            data = response.json()
            
            # Check for errors in response
            if 'error' in data:
                error_info = data['error']
                error_msg = error_info.get('message', str(error_info))
                print(f'❌ Google Translate API error: {error_msg}')
                raise ValueError(f'Google Translate error: {error_msg}')
            
            # Extract translations
            translations_data = data.get('data', {})
            translations_list = translations_data.get('translations', [])
            
            if not translations_list:
                print(f'⚠️ No translations returned from Google Translate API')
                print(f'Response data: {data}')
                raise ValueError('No translations returned from Google Translate API')
            
            # Extract translated text from each translation object
            result = [item.get('translatedText', '') for item in translations_list]
            
            # Ensure we return the same number of translations as input texts
            if len(result) != len(texts):
                print(f'⚠️ Translation count mismatch: got {len(result)}, expected {len(texts)}')
                # Pad or truncate as needed
                while len(result) < len(texts):
                    result.append('')
                result = result[:len(texts)]
            
            return result
            
        except requests.exceptions.RequestException as e:
            print(f'❌ Google Translate API request exception: {e}')
            raise ValueError(f'Google Translate API request failed: {str(e)}')
        except ValueError as e:
            # Re-raise ValueError as-is
            raise
        except Exception as e:
            print(f'❌ Unexpected error in Google Translate: {e}')
            raise ValueError(f'Unexpected Google Translate error: {str(e)}')

    response = requests.post(TRANSLATE_ENDPOINT, json=payload, timeout=60)
    if not response.ok:
        raise ValueError(f'Translation API error {response.status_code}: {response.text}')
    data = response.json()
    if isinstance(data, list):
        return [item.get('translatedText', '') for item in data]
    if isinstance(data, dict):
        if isinstance(data.get('translatedText'), list):
            return data.get('translatedText')
        if isinstance(data.get('translatedText'), str):
            return [data.get('translatedText')]
        if isinstance(data.get('translations'), list):
            return [item.get('text') or item.get('translatedText', '') for item in data.get('translations')]
    raise ValueError(f'Unexpected translation response format: {data}')

# Helper function to convert ObjectId to string
def serialize_dish(dish):
    """Convert MongoDB document to JSON-serializable format.

    - Keep existing numeric business id in `id` if present (1, 2, 3, ...)
    - Expose MongoDB ObjectId separately as `mongoId` for AI / internal use
    """
    if dish is None:
        return None

    # Always expose the MongoDB ObjectId as a string
    dish['mongoId'] = str(dish['_id'])

    # If the document already has a numeric/business `id`, keep it.
    # Otherwise, fall back to using the ObjectId string as `id`.
    if 'id' not in dish:
        dish['id'] = dish['mongoId']

    # Remove raw _id to keep the JSON clean
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

# ==================== EMBEDDINGS API PROXY ====================

@app.route('/api/embeddings', methods=['POST', 'OPTIONS'])
def get_embeddings():
    """Proxy for embeddings API to avoid exposing keys in frontend."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    try:
        data = request.json or {}
        texts = data.get('texts', [])
        if not isinstance(texts, list) or len(texts) == 0:
            return jsonify({
                'error': 'Invalid request',
                'message': 'texts must be a non-empty list'
            }), 400

        payload = {
            'model': EMBEDDINGS_MODEL,
            'input': {
                'texts': texts
            }
        }
        headers = {
            'Authorization': f'Bearer {EMBEDDINGS_API_KEY}',
            'Content-Type': 'application/json'
        }
        response = requests.post(EMBEDDINGS_ENDPOINT, headers=headers, json=payload, timeout=30)
        return jsonify(response.json()), response.status_code
    except Exception as e:
        return jsonify({
            'error': 'Embeddings error',
            'message': str(e)
        }), 500

# ==================== TRANSLATION API PROXY ====================

@app.route('/api/translate', methods=['POST', 'OPTIONS'])
def translate_texts():
    """Proxy translation API to avoid exposing keys in frontend."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    try:
        data = request.json or {}
        texts = data.get('texts', [])
        target = data.get('target', 'en')
        source = data.get('source', 'en')
        if not isinstance(texts, list) or len(texts) == 0:
            return jsonify({
                'error': 'Invalid request',
                'message': 'texts must be a non-empty list'
            }), 400

        payload = {
            'q': texts,
            'source': source,
            'target': target,
            'format': 'text'
        }
        if TRANSLATE_API_KEY:
            payload['api_key'] = TRANSLATE_API_KEY

        response = requests.post(TRANSLATE_ENDPOINT, json=payload, timeout=30)
        if not response.ok:
            return jsonify({
                'error': 'Translation API error',
                'message': response.text
            }), response.status_code

        return jsonify(response.json()), 200
    except Exception as e:
        return jsonify({
            'error': 'Translation error',
            'message': str(e)
        }), 500

@app.route('/api/admin/translate-dishes', methods=['POST', 'OPTIONS'])
def translate_dishes():
    """Translate all dishes and store translations in MongoDB."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    if dishes_collection is None:
        return jsonify({
            'error': 'Database not connected'
        }), 500

    try:
        payload = request.json or {}
        languages = payload.get('languages', ['zh', 'zhCN'])
        
        # Map language codes for Google Translate API
        # Google Translate uses 'zh-TW' for Traditional Chinese and 'zh-CN' for Simplified Chinese
        lang_map = {
            'zh': 'zh-TW',  # Traditional Chinese
            'zhCN': 'zh-CN'  # Simplified Chinese
        }

        dishes = list(dishes_collection.find({}))
        updated = 0
        errors = []
        
        for dish in dishes:
            try:
                dish_name = dish.get('name', 'Unknown')
                translations = dish.get('translations', {})
                
                for lang in languages:
                    target = lang_map.get(lang, lang)
                    texts = [
                        dish.get('name', ''),
                        dish.get('description', ''),
                        ', '.join(dish.get('ingredients', [])) if isinstance(dish.get('ingredients'), list) else str(dish.get('ingredients', ''))
                    ]
                    
                    # Filter out empty texts
                    texts = [t for t in texts if t and t.strip()]
                    if not texts:
                        print(f'⚠️ Skipping dish "{dish_name}" - no text to translate')
                        continue
                    
                    try:
                        # Try batch translation first
                        translated = translate_texts_internal(texts, target, source='en')
                        
                        # Ensure we got the right number of translations
                        if len(translated) < len(texts):
                            raise ValueError(f'Got {len(translated)} translations but expected {len(texts)}')
                            
                    except Exception as translate_error:
                        print(f'⚠️ Batch translation failed for dish "{dish_name}", trying one-by-one: {translate_error}')
                        # Fallback: translate one by one in case batch is rejected
                        translated = []
                        for text in texts:
                            if text and text.strip():
                                try:
                                    result = translate_texts_internal([text], target, source='en')
                                    if isinstance(result, list) and len(result) > 0:
                                        translated.append(result[0])
                                    else:
                                        translated.append(text)  # Fallback to original
                                except Exception as single_error:
                                    print(f'⚠️ Single text translation failed: {single_error}')
                                    translated.append(text)  # Fallback to original
                        
                        if len(translated) < len(texts):
                            error_msg = f'Partial translation for dish "{dish_name}": only got {len(translated)}/{len(texts)} translations'
                            print(f'❌ {error_msg}')
                            errors.append(error_msg)
                            # Continue with partial translations
                    
                    # Store translations (pad with empty strings if needed)
                    while len(translated) < 3:
                        translated.append('')
                    
                    translations[lang] = {
                        'name': translated[0] if len(translated) > 0 else dish.get('name', ''),
                        'description': translated[1] if len(translated) > 1 else dish.get('description', ''),
                        'ingredients': translated[2] if len(translated) > 2 else (', '.join(dish.get('ingredients', [])) if isinstance(dish.get('ingredients'), list) else str(dish.get('ingredients', '')))
                    }
                
                # Update dish with translations
                dishes_collection.update_one(
                    {'_id': dish['_id']},
                    {'$set': {'translations': translations}}
                )
                updated += 1
                
            except Exception as dish_error:
                error_msg = f'Error translating dish "{dish.get("name", "Unknown")}": {str(dish_error)}'
                print(f'❌ {error_msg}')
                errors.append(error_msg)
                continue

        response_data = {
            'success': True,
            'updated': updated,
            'total': len(dishes)
        }
        if errors:
            response_data['warnings'] = errors[:5]  # Limit to first 5 errors
        
        return jsonify(response_data), 200
        
    except Exception as e:
        error_msg = f'Translation error: {str(e)}'
        print(f'❌ {error_msg}')
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': 'Translation error',
            'message': error_msg
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

