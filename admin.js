// Admin Panel JavaScript
// Manages dish CRUD operations with MongoDB via API

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://web-production-f1d28.up.railway.app';

let dishes = [];

// Load all dishes on page load
document.addEventListener('DOMContentLoaded', () => {
    loadDishes();
});

// Load all dishes from API
async function loadDishes() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/menu`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.dishes) {
            dishes = data.dishes;
            updateDishCount(dishes.length);
            renderDishes(dishes);
        } else {
            throw new Error('Invalid response format');
        }
    } catch (error) {
        console.error('Error loading dishes:', error);
        showError('Failed to load dishes. Make sure the backend server is running.');
        document.getElementById('dishesList').innerHTML = `
            <div class="error">
                <strong>Error:</strong> ${error.message}<br>
                <small>Check that the backend server is running on ${API_BASE_URL}</small>
            </div>
        `;
    }
}

async function translateAllDishes() {
    try {
        const button = document.querySelector('.control-panel .btn-secondary');
        if (button) {
            button.disabled = true;
            button.textContent = '🌐 Translating...';
        }
        const response = await fetch(`${API_BASE_URL}/api/admin/translate-dishes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                languages: ['zh', 'zhCN']
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Translation failed');
        }

        alert(`✅ Translated ${data.updated || 0} dishes.`);
        await loadDishes();
    } catch (error) {
        console.error('Translation error:', error);
        const message = error.message.includes('Failed to fetch')
            ? 'Backend not reachable. Please start the API server (menu_server.py) and try again.'
            : error.message;
        alert(`❌ Translation failed: ${message}`);
    } finally {
        const button = document.querySelector('.control-panel .btn-secondary');
        if (button) {
            button.disabled = false;
            button.textContent = '🌐 Translate Dishes';
        }
    }
}

// Update dish count display
function updateDishCount(count) {
    document.getElementById('dishCount').textContent = count;
}

// Render dishes in the grid
function renderDishes(dishesList) {
    const dishesListEl = document.getElementById('dishesList');
    
    if (dishesList.length === 0) {
        dishesListEl.innerHTML = '<p class="loading">No dishes found. Click "Add New Dish" to create one.</p>';
        return;
    }

    dishesListEl.innerHTML = dishesList.map(dish => `
        <div class="dish-card">
            <div class="dish-header">
                <div class="dish-name">
                    <span class="dish-emoji">${dish.emoji || '🍽️'}</span>
                    ${dish.name}
                </div>
                <div class="dish-actions">
                    <button class="btn btn-primary btn-small" onclick="editDish('${dish.id || dish.mongoId}')">✏️ Edit</button>
                    <button class="btn btn-danger btn-small" onclick="deleteDish('${dish.id || dish.mongoId}')">🗑️ Delete</button>
                </div>
            </div>
            <div class="dish-info">
                <p><strong>Description:</strong> ${dish.description}</p>
                <p><strong>Ingredients:</strong> ${formatIngredients(dish.ingredients)}</p>
                <p><strong>Nutrition:</strong> ${formatNutrition(dish.nutrition)}</p>
                <div class="dish-price">$${dish.price.toFixed(2)}</div>
                <p><strong>Category:</strong> ${dish.category}</p>
                <p><strong>ID:</strong> ${dish.id || 'N/A'} ${dish.mongoId ? `(MongoDB: ${dish.mongoId.substring(0, 8)}...)` : ''}</p>
            </div>
            ${renderTags(dish)}
        </div>
    `).join('');
}

function formatIngredients(ingredients) {
    if (Array.isArray(ingredients) && ingredients.length > 0) {
        return ingredients.join(', ');
    }
    if (typeof ingredients === 'string' && ingredients.trim()) {
        return ingredients.trim();
    }
    return 'N/A';
}

function formatNutrition(nutrition) {
    if (!nutrition) return 'N/A';
    const parts = [
        `Energy ${nutrition.energy_kcal ?? 'N/A'} kcal`,
        `Protein ${nutrition.protein_g ?? 'N/A'} g`,
        `Fat ${nutrition.fat_g ?? 'N/A'} g`,
        `Carbs ${nutrition.carbohydrates_g ?? 'N/A'} g`,
        `Sugars ${nutrition.sugars_g ?? 'N/A'} g`,
        `Sodium ${nutrition.sodium_mg ?? 'N/A'} mg`
    ];
    return parts.join(' • ');
}

// Render tags, allergens, and restrictions
function renderTags(dish) {
    let html = '<div class="dish-tags">';
    
    if (dish.tags && dish.tags.length > 0) {
        dish.tags.forEach(tag => {
            html += `<span class="tag">${tag}</span>`;
        });
    }
    
    if (dish.allergens && dish.allergens.length > 0) {
        dish.allergens.forEach(allergen => {
            html += `<span class="tag tag-allergen">⚠️ ${allergen}</span>`;
        });
    }
    
    if (dish.restrictions && dish.restrictions.length > 0) {
        dish.restrictions.forEach(restriction => {
            html += `<span class="tag tag-restriction">${restriction}</span>`;
        });
    }
    
    html += '</div>';
    return html;
}

// Show add dish form
function showAddDishForm() {
    document.getElementById('formTitle').textContent = 'Add New Dish';
    document.getElementById('dishForm').reset();
    document.getElementById('dishId').value = '';
    document.getElementById('dishMongoId').value = '';
    document.getElementById('dishFormModal').style.display = 'block';
}

// Edit dish - populate form with dish data
async function editDish(dishId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/menu/${dishId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.dish) {
            const dish = data.dish;
            
            // Populate form
            document.getElementById('formTitle').textContent = 'Edit Dish';
            document.getElementById('dishId').value = dish.id || '';
            document.getElementById('dishMongoId').value = dish.mongoId || dish.id || '';
            document.getElementById('dishName').value = dish.name || '';
            document.getElementById('dishDescription').value = dish.description || '';
            document.getElementById('dishIngredients').value = Array.isArray(dish.ingredients)
                ? dish.ingredients.join(', ')
                : (dish.ingredients || '');
            document.getElementById('dishPrice').value = dish.price || '';
            document.getElementById('dishCategory').value = dish.category || 'appetizers';
            document.getElementById('dishEmoji').value = dish.emoji || '';
            document.getElementById('dishTags').value = Array.isArray(dish.tags) ? dish.tags.join(', ') : (dish.tags || '');
            document.getElementById('dishAllergens').value = Array.isArray(dish.allergens) ? dish.allergens.join(', ') : (dish.allergens || '');
            document.getElementById('dishRestrictions').value = Array.isArray(dish.restrictions) ? dish.restrictions.join(', ') : (dish.restrictions || '');

            const nutrition = dish.nutrition || {};
            document.getElementById('nutritionEnergy').value = nutrition.energy_kcal ?? '';
            document.getElementById('nutritionProtein').value = nutrition.protein_g ?? '';
            document.getElementById('nutritionFat').value = nutrition.fat_g ?? '';
            document.getElementById('nutritionSatFat').value = nutrition.saturated_fat_g ?? '';
            document.getElementById('nutritionTransFat').value = nutrition.trans_fat_g ?? '';
            document.getElementById('nutritionCarbs').value = nutrition.carbohydrates_g ?? '';
            document.getElementById('nutritionSugars').value = nutrition.sugars_g ?? '';
            document.getElementById('nutritionSodium').value = nutrition.sodium_mg ?? '';
            
            document.getElementById('dishFormModal').style.display = 'block';
        } else {
            throw new Error('Dish not found');
        }
    } catch (error) {
        console.error('Error loading dish:', error);
        showError(`Failed to load dish: ${error.message}`);
    }
}

// Save dish (create or update)
async function saveDish(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    // Build dish object
    const dish = {
        name: formData.get('name'),
        description: formData.get('description'),
        price: parseFloat(formData.get('price')),
        category: formData.get('category'),
        emoji: formData.get('emoji') || '🍽️'
    };

    const ingredientsRaw = formData.get('ingredients');
    dish.ingredients = ingredientsRaw
        ? ingredientsRaw.split(/[,|\n]/).map(i => i.trim()).filter(i => i)
        : [];
    
    // Parse comma-separated arrays
    const tags = formData.get('tags');
    if (tags && tags.trim()) {
        dish.tags = tags.split(',').map(t => t.trim()).filter(t => t);
    } else {
        dish.tags = [];
    }
    
    const allergens = formData.get('allergens');
    if (allergens && allergens.trim()) {
        dish.allergens = allergens.split(',').map(a => a.trim()).filter(a => a);
    } else {
        dish.allergens = [];
    }
    
    const restrictions = formData.get('restrictions');
    if (restrictions && restrictions.trim()) {
        dish.restrictions = restrictions.split(',').map(r => r.trim()).filter(r => r);
    } else {
        dish.restrictions = [];
    }

    dish.nutrition = {
        energy_kcal: parseNumber(formData.get('nutritionEnergy')),
        protein_g: parseNumber(formData.get('nutritionProtein')),
        fat_g: parseNumber(formData.get('nutritionFat')),
        saturated_fat_g: parseNumber(formData.get('nutritionSatFat')),
        trans_fat_g: parseNumber(formData.get('nutritionTransFat')),
        carbohydrates_g: parseNumber(formData.get('nutritionCarbs')),
        sugars_g: parseNumber(formData.get('nutritionSugars')),
        sodium_mg: parseNumber(formData.get('nutritionSodium'))
    };
    
    // Add id if editing
    const dishId = formData.get('id');
    const mongoId = formData.get('mongoId');
    const idToUse = mongoId || dishId;
    
    try {
        let response;
        if (idToUse) {
            // Update existing dish
            response = await fetch(`${API_BASE_URL}/api/menu/${idToUse}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dish)
            });
        } else {
            // Create new dish - need to assign an ID
            const maxId = dishes.length > 0 ? Math.max(...dishes.map(d => d.id || 0)) : 0;
            dish.id = maxId + 1;
            
            response = await fetch(`${API_BASE_URL}/api/menu`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dish)
            });
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        showSuccess(idToUse ? 'Dish updated successfully!' : 'Dish created successfully!');
        closeDishForm();
        loadDishes();
    } catch (error) {
        console.error('Error saving dish:', error);
        showError(`Failed to save dish: ${error.message}`);
    }
}

function parseNumber(value) {
    if (value === null || value === undefined || String(value).trim() === '') {
        return null;
    }
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
}

// Delete dish
async function deleteDish(dishId) {
    if (!confirm('Are you sure you want to delete this dish? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/menu/${dishId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        showSuccess('Dish deleted successfully!');
        loadDishes();
    } catch (error) {
        console.error('Error deleting dish:', error);
        showError(`Failed to delete dish: ${error.message}`);
    }
}

// Close dish form modal
function closeDishForm() {
    document.getElementById('dishFormModal').style.display = 'none';
    document.getElementById('dishForm').reset();
}

// Show success message
function showSuccess(message) {
    const existing = document.querySelector('.success');
    if (existing) existing.remove();
    
    const success = document.createElement('div');
    success.className = 'success';
    success.textContent = message;
    document.querySelector('.admin-content').insertBefore(success, document.querySelector('.control-panel'));
    
    setTimeout(() => success.remove(), 5000);
}

// Show error message
function showError(message) {
    const existing = document.querySelector('.error');
    if (existing) existing.remove();
    
    const error = document.createElement('div');
    error.className = 'error';
    error.innerHTML = `<strong>Error:</strong> ${message}`;
    document.querySelector('.admin-content').insertBefore(error, document.querySelector('.control-panel'));
    
    setTimeout(() => error.remove(), 8000);
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('dishFormModal');
    if (event.target === modal) {
        closeDishForm();
    }
}

