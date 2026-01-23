#!/usr/bin/env python3
"""
Script to seed MongoDB with initial menu data
Run this once to populate your database with sample dishes
"""

from pymongo import MongoClient
import os
import sys

# Fix Windows console encoding for emojis
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# MongoDB Configuration
# You can set your connection string here directly, or use environment variable
# Option 1: Set directly in code (easier for local development)
MONGODB_URI_DEFAULT = 'mongodb+srv://wch2701877132_db_user:DISHORDERWCH@dishes.hfs6i6e.mongodb.net/restaurant_db?retryWrites=true&w=majority'

# Option 2: Use environment variable (for production/cloud deployment)
MONGODB_URI = os.environ.get('MONGODB_URI', MONGODB_URI_DEFAULT)
DATABASE_NAME = os.environ.get('DATABASE_NAME', 'restaurant_db')
COLLECTION_NAME = os.environ.get('COLLECTION_NAME', 'dishes')

# Sample menu data matching the schema
sample_dishes = [
    # Appetizers
    {
        "id": 1,
        "name": "Caesar Salad",
        "description": "Fresh romaine lettuce with caesar dressing, croutons, and parmesan - crisp",
        "ingredients": ["romaine lettuce", "caesar dressing", "croutons", "parmesan"],
        "nutrition": {
            "energy_kcal": 320,
            "protein_g": 8,
            "fat_g": 26,
            "saturated_fat_g": 5,
            "trans_fat_g": 0,
            "carbohydrates_g": 14,
            "sugars_g": 3,
            "sodium_mg": 520
        },
        "price": 8.99,
        "category": "appetizers",
        "emoji": "🥗",
        "image": "caesar salad.png",
        "tags": ["vegetarian", "gluten-free-option"],
        "allergens": ["dairy"],
        "restrictions": [],
        "iddsi_level": 7,
        "flavor": "fresh and savory",
        "taste_profile": "lightly tangy and creamy (not sweet)",
        "cuisine": "Italian-American",
        "style": "tossed and chilled"
    },
    {
        "id": 2,
        "name": "Bruschetta",
        "description": "Toasted bread topped with fresh tomatoes, basil, and mozzarella - bright",
        "ingredients": ["toasted bread", "tomatoes", "basil", "mozzarella"],
        "nutrition": {
            "energy_kcal": 280,
            "protein_g": 9,
            "fat_g": 12,
            "saturated_fat_g": 4,
            "trans_fat_g": 0,
            "carbohydrates_g": 32,
            "sugars_g": 5,
            "sodium_mg": 430
        },
        "price": 7.99,
        "category": "appetizers",
        "emoji": "🍞",
        "image": "bruschetta.png",
        "tags": ["vegetarian"],
        "allergens": ["gluten", "dairy"],
        "restrictions": [],
        "iddsi_level": 7,
        "flavor": "fresh, herbaceous, and lightly savory",
        "taste_profile": "mildly tangy and not spicy",
        "cuisine": "Italian",
        "style": "toasted"
    },
    {
        "id": 3,
        "name": "Chicken Wings",
        "description": "Crispy chicken wings with your choice of sauce - crispy",
        "ingredients": ["chicken wings", "seasoning", "sauce"],
        "nutrition": {
            "energy_kcal": 420,
            "protein_g": 28,
            "fat_g": 30,
            "saturated_fat_g": 8,
            "trans_fat_g": 0.5,
            "carbohydrates_g": 6,
            "sugars_g": 1,
            "sodium_mg": 860
        },
        "price": 10.99,
        "category": "appetizers",
        "emoji": "🍗",
        "image": "chicken wings.png",
        "tags": [],
        "allergens": [],
        "restrictions": [],
        "iddsi_level": 7,
        "flavor": "savory, smoky, and umami",
        "taste_profile": "salty and mildly spicy",
        "cuisine": "American",
        "style": "deep-fried"
    },
    {
        "id": 4,
        "name": "Spring Rolls",
        "description": "Vegetable spring rolls with sweet and sour sauce - light",
        "ingredients": ["spring roll wrappers", "mixed vegetables", "sweet and sour sauce"],
        "nutrition": {
            "energy_kcal": 250,
            "protein_g": 6,
            "fat_g": 12,
            "saturated_fat_g": 2,
            "trans_fat_g": 0,
            "carbohydrates_g": 30,
            "sugars_g": 4,
            "sodium_mg": 400
        },
        "price": 6.99,
        "category": "appetizers",
        "emoji": "🥟",
        "image": "spring rolls.png",
        "tags": ["vegetarian"],
        "allergens": [],
        "restrictions": [],
        "iddsi_level": 6,
        "flavor": "light and vegetal",
        "taste_profile": "mildly sweet and not spicy",
        "cuisine": "East Asian",
        "style": "fried"
    },
    
    # Main Courses
    {
        "id": 5,
        "name": "Grilled Salmon",
        "description": "Fresh salmon fillet with lemon butter sauce and vegetables - savory",
        "ingredients": ["salmon fillet", "lemon butter sauce", "vegetables"],
        "nutrition": {
            "energy_kcal": 520,
            "protein_g": 42,
            "fat_g": 34,
            "saturated_fat_g": 7,
            "trans_fat_g": 0,
            "carbohydrates_g": 8,
            "sugars_g": 2,
            "sodium_mg": 620
        },
        "price": 18.99,
        "category": "mains",
        "emoji": "🐟",
        "image": "grilled salmon.png",
        "tags": ["low-carb", "high-protein"],
        "allergens": ["fish"],
        "restrictions": [],
        "iddsi_level": 6,
        "flavor": "savory and buttery",
        "taste_profile": "rich and not sour",
        "cuisine": "Mediterranean",
        "style": "grilled"
    },
    {
        "id": 6,
        "name": "Beef Steak",
        "description": "Tender ribeye steak cooked to perfection with mashed potatoes - hearty",
        "ingredients": ["ribeye steak", "mashed potatoes"],
        "nutrition": {
            "energy_kcal": 680,
            "protein_g": 48,
            "fat_g": 45,
            "saturated_fat_g": 18,
            "trans_fat_g": 1,
            "carbohydrates_g": 20,
            "sugars_g": 2,
            "sodium_mg": 720
        },
        "price": 24.99,
        "category": "mains",
        "emoji": "🥩",
        "image": "beaf steak.png",
        "tags": ["high-protein", "low-carb"],
        "allergens": [],
        "restrictions": [],
        "iddsi_level": 7,
        "flavor": "hearty, savory, and umami",
        "taste_profile": "rich and salty",
        "cuisine": "American steakhouse",
        "style": "grilled"
    },
    {
        "id": 7,
        "name": "Chicken Pasta",
        "description": "Creamy pasta with grilled chicken and parmesan cheese - creamy",
        "ingredients": ["pasta", "grilled chicken", "cream sauce", "parmesan cheese"],
        "nutrition": {
            "energy_kcal": 610,
            "protein_g": 36,
            "fat_g": 28,
            "saturated_fat_g": 10,
            "trans_fat_g": 0.5,
            "carbohydrates_g": 58,
            "sugars_g": 6,
            "sodium_mg": 780
        },
        "price": 14.99,
        "category": "mains",
        "emoji": "🍝",
        "image": "chicken pasta.png",
        "tags": ["high-protein"],
        "allergens": ["gluten", "dairy"],
        "restrictions": [],
        "iddsi_level": 6,
        "flavor": "creamy and savory",
        "taste_profile": "rich and not spicy",
        "cuisine": "Italian-American",
        "style": "sauteed and sauced"
    },
    {
        "id": 8,
        "name": "Margherita Pizza",
        "description": "Classic pizza with tomato, mozzarella, and fresh basil - classic",
        "ingredients": ["pizza dough", "tomato sauce", "mozzarella", "basil"],
        "nutrition": {
            "energy_kcal": 640,
            "protein_g": 24,
            "fat_g": 26,
            "saturated_fat_g": 11,
            "trans_fat_g": 0.5,
            "carbohydrates_g": 72,
            "sugars_g": 8,
            "sodium_mg": 820
        },
        "price": 12.99,
        "category": "mains",
        "emoji": "🍕",
        "image": "margherita pizza.png",
        "tags": ["vegetarian"],
        "allergens": ["gluten", "dairy"],
        "restrictions": [],
        "iddsi_level": 7,
        "flavor": "savory and herbaceous",
        "taste_profile": "mildly tangy and balanced",
        "cuisine": "Italian",
        "style": "baked"
    },
    {
        "id": 9,
        "name": "Burger Deluxe",
        "description": "Juicy beef burger with cheese, lettuce, tomato, and special sauce - juicy",
        "ingredients": ["beef patty", "bun", "cheese", "lettuce", "tomato", "special sauce"],
        "nutrition": {
            "energy_kcal": 750,
            "protein_g": 40,
            "fat_g": 45,
            "saturated_fat_g": 16,
            "trans_fat_g": 1,
            "carbohydrates_g": 48,
            "sugars_g": 9,
            "sodium_mg": 980
        },
        "price": 13.99,
        "category": "mains",
        "emoji": "🍔",
        "image": "burger deluxe.png",
        "tags": [],
        "allergens": ["gluten", "dairy"],
        "restrictions": [],
        "iddsi_level": 7,
        "flavor": "savory, juicy, and umami",
        "taste_profile": "salty and rich",
        "cuisine": "American",
        "style": "grilled"
    },
    {
        "id": 10,
        "name": "Vegetable Curry",
        "description": "Spicy vegetable curry with rice and naan bread - spicy",
        "ingredients": ["mixed vegetables", "curry sauce", "rice", "naan bread"],
        "nutrition": {
            "energy_kcal": 540,
            "protein_g": 14,
            "fat_g": 22,
            "saturated_fat_g": 8,
            "trans_fat_g": 0,
            "carbohydrates_g": 68,
            "sugars_g": 10,
            "sodium_mg": 760
        },
        "price": 11.99,
        "category": "mains",
        "emoji": "🍛",
        "image": "vegetable curry.png",
        "tags": ["vegetarian", "vegan-option"],
        "allergens": ["gluten"],
        "restrictions": [],
        "iddsi_level": 6,
        "flavor": "aromatic and spicy",
        "taste_profile": "spicy and slightly sweet",
        "cuisine": "Indian",
        "style": "simmered"
    },
    
    # Desserts
    {
        "id": 11,
        "name": "Chocolate Cake",
        "description": "Rich chocolate layer cake with vanilla frosting - rich",
        "ingredients": ["chocolate cake", "vanilla frosting"],
        "nutrition": {
            "energy_kcal": 480,
            "protein_g": 6,
            "fat_g": 26,
            "saturated_fat_g": 14,
            "trans_fat_g": 0.5,
            "carbohydrates_g": 58,
            "sugars_g": 42,
            "sodium_mg": 360
        },
        "price": 7.99,
        "category": "desserts",
        "emoji": "🍰",
        "image": "chocolate cake.png",
        "tags": ["vegetarian"],
        "allergens": ["gluten", "dairy", "eggs"],
        "restrictions": ["high-sugar"],
        "iddsi_level": 6,
        "flavor": "rich and chocolatey",
        "taste_profile": "sweet and not sour",
        "cuisine": "Western",
        "style": "baked"
    },
    {
        "id": 12,
        "name": "Ice Cream Sundae",
        "description": "Vanilla ice cream with chocolate sauce and whipped cream - sweet",
        "ingredients": ["vanilla ice cream", "chocolate sauce", "whipped cream"],
        "nutrition": {
            "energy_kcal": 420,
            "protein_g": 7,
            "fat_g": 22,
            "saturated_fat_g": 13,
            "trans_fat_g": 0.5,
            "carbohydrates_g": 48,
            "sugars_g": 39,
            "sodium_mg": 210
        },
        "price": 6.99,
        "category": "desserts",
        "emoji": "🍨",
        "image": "ice cream sundae.png",
        "tags": ["vegetarian"],
        "allergens": ["dairy"],
        "restrictions": ["high-sugar"],
        "iddsi_level": 4,
        "flavor": "sweet and creamy",
        "taste_profile": "very sweet and cold",
        "cuisine": "American",
        "style": "frozen"
    },
    {
        "id": 13,
        "name": "Cheesecake",
        "description": "New York style cheesecake with berry compote - creamy",
        "ingredients": ["cheesecake", "berry compote"],
        "nutrition": {
            "energy_kcal": 520,
            "protein_g": 8,
            "fat_g": 34,
            "saturated_fat_g": 18,
            "trans_fat_g": 1,
            "carbohydrates_g": 46,
            "sugars_g": 36,
            "sodium_mg": 390
        },
        "price": 8.99,
        "category": "desserts",
        "emoji": "🧁",
        "image": "cheesecake.png",
        "tags": ["vegetarian"],
        "allergens": ["gluten", "dairy", "eggs"],
        "restrictions": ["high-sugar"],
        "iddsi_level": 4,
        "flavor": "creamy and rich",
        "taste_profile": "sweet with mild tang",
        "cuisine": "American",
        "style": "baked and chilled"
    },
    {
        "id": 14,
        "name": "Tiramisu",
        "description": "Classic Italian dessert with coffee and mascarpone - silky",
        "ingredients": ["mascarpone", "coffee", "dessert layers"],
        "nutrition": {
            "energy_kcal": 450,
            "protein_g": 7,
            "fat_g": 30,
            "saturated_fat_g": 17,
            "trans_fat_g": 0.5,
            "carbohydrates_g": 42,
            "sugars_g": 34,
            "sodium_mg": 320
        },
        "price": 9.99,
        "category": "desserts",
        "emoji": "☕",
        "image": "tiramisu.png",
        "tags": ["vegetarian"],
        "allergens": ["gluten", "dairy", "eggs"],
        "restrictions": ["high-sugar", "caffeine"],
        "iddsi_level": 4,
        "flavor": "coffee-forward and creamy",
        "taste_profile": "sweet with slight bitterness",
        "cuisine": "Italian",
        "style": "layered and chilled"
    },
    
    # Drinks
    {
        "id": 15,
        "name": "Fresh Orange Juice",
        "description": "Freshly squeezed orange juice - fresh",
        "ingredients": ["orange juice"],
        "nutrition": {
            "energy_kcal": 110,
            "protein_g": 2,
            "fat_g": 0,
            "saturated_fat_g": 0,
            "trans_fat_g": 0,
            "carbohydrates_g": 26,
            "sugars_g": 21,
            "sodium_mg": 5
        },
        "price": 4.99,
        "category": "drinks",
        "emoji": "🍹",
        "image": "fresh orange juice.png",
        "tags": ["vegetarian", "vegan"],
        "allergens": [],
        "restrictions": ["high-sugar"],
        "iddsi_level": 0,
        "flavor": "fresh and citrusy",
        "taste_profile": "sweet-tart",
        "cuisine": "global",
        "style": "freshly squeezed"
    },
    {
        "id": 16,
        "name": "Iced Coffee",
        "description": "Cold brew coffee with ice and cream - bold",
        "ingredients": ["cold brew coffee", "ice", "cream"],
        "nutrition": {
            "energy_kcal": 90,
            "protein_g": 2,
            "fat_g": 4,
            "saturated_fat_g": 2.5,
            "trans_fat_g": 0,
            "carbohydrates_g": 10,
            "sugars_g": 8,
            "sodium_mg": 60
        },
        "price": 5.99,
        "category": "drinks",
        "emoji": "🧊",
        "image": "iced coffee.png",
        "tags": ["vegetarian"],
        "allergens": ["dairy"],
        "restrictions": ["caffeine"],
        "iddsi_level": 0,
        "flavor": "bold and roasted",
        "taste_profile": "slightly bitter and creamy",
        "cuisine": "global cafe",
        "style": "cold-brewed"
    },
    {
        "id": 17,
        "name": "Lemonade",
        "description": "Fresh lemonade with mint leaves - zesty",
        "ingredients": ["lemon juice", "water", "sugar", "mint leaves"],
        "nutrition": {
            "energy_kcal": 120,
            "protein_g": 0,
            "fat_g": 0,
            "saturated_fat_g": 0,
            "trans_fat_g": 0,
            "carbohydrates_g": 30,
            "sugars_g": 28,
            "sodium_mg": 10
        },
        "price": 4.99,
        "category": "drinks",
        "emoji": "🍋",
        "image": "lemonade.png",
        "tags": ["vegetarian", "vegan"],
        "allergens": [],
        "restrictions": ["high-sugar"],
        "iddsi_level": 0,
        "flavor": "bright and citrusy",
        "taste_profile": "sweet and sour",
        "cuisine": "global",
        "style": "mixed and chilled"
    },
    {
        "id": 18,
        "name": "Soda",
        "description": "Assorted soft drinks - fizzy",
        "ingredients": ["soft drink"],
        "nutrition": {
            "energy_kcal": 150,
            "protein_g": 0,
            "fat_g": 0,
            "saturated_fat_g": 0,
            "trans_fat_g": 0,
            "carbohydrates_g": 39,
            "sugars_g": 39,
            "sodium_mg": 45
        },
        "price": 3.99,
        "category": "drinks",
        "emoji": "🥤",
        "image": "soda.png",
        "tags": ["vegetarian", "vegan"],
        "allergens": [],
        "restrictions": ["high-sugar"],
        "iddsi_level": 0,
        "flavor": "sweet and fizzy",
        "taste_profile": "very sweet",
        "cuisine": "global",
        "style": "carbonated"
    }
]

def seed_database():
    """Insert sample dishes into MongoDB"""
    try:
        # Connect to MongoDB
        client = MongoClient(MONGODB_URI)
        db = client[DATABASE_NAME]
        collection = db[COLLECTION_NAME]
        
        # Clear existing data (optional - comment out if you want to keep existing data)
        print('🗑️  Clearing existing dishes...')
        collection.delete_many({})
        
        # Insert sample dishes
        print(f'📝 Inserting {len(sample_dishes)} dishes...')
        result = collection.insert_many(sample_dishes)
        
        print(f'✅ Successfully inserted {len(result.inserted_ids)} dishes!')
        print(f'📊 Database: {DATABASE_NAME}')
        print(f'📊 Collection: {COLLECTION_NAME}')
        
        # Verify insertion
        count = collection.count_documents({})
        print(f'📊 Total dishes in database: {count}')
        
        client.close()
        
    except Exception as e:
        print(f'❌ Error: {e}')
        print('\n💡 Make sure:')
        print('   1. MongoDB is running (or MONGODB_URI is set correctly)')
        print('   2. You have write permissions to the database')
        return False
    
    return True

if __name__ == '__main__':
    print('🌱 Seeding MongoDB database...\n')
    success = seed_database()
    
    if success:
        print('\n✅ Database seeding completed!')
    else:
        print('\n❌ Database seeding failed!')

