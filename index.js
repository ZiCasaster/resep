const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');

class CookpadScraper {
    constructor() {
        this.client = axios.create({
            baseURL: 'https://cookpad.com',
            headers: {
                'accept': 'text/html, application/xhtml+xml',
                'accept-language': 'id-ID,id;q=0.9',
                'cache-control': 'no-cache',
                'pragma': 'no-cache',
                'priority': 'u=1, i',
                'referer': 'https://cookpad.com/id',
                'sec-ch-ua': '"Lemur";v="135", "", "", "Microsoft Edge Simulate";v="135"',
                'sec-ch-ua-mobile': '?1',
                'sec-ch-ua-platform': '"Android"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36'
            }
        });
    }

    async getRecipeDetails(url) {
        try {
            const response = await this.client.get(url);
            const html = response.data;
            const $ = cheerio.load(html);

            const recipeDetails = {};

            const recipeImageElement = $('#recipe_image img');
            recipeDetails.full_image = recipeImageElement.attr('src') || 'N/A';

            recipeDetails.title = $('h1[data-toggle-class-target-id-value="header--recipe-title"]').text().trim() || 'N/A';

            const authorLink = $('a[href*="/id/pengguna/"]');
            recipeDetails.author = authorLink.find('span.text-cookpad-14').text().trim() || 'N/A';
            recipeDetails.author_username = authorLink.find('span[dir="ltr"]').text().trim() || 'N/A';
            recipeDetails.author_avatar = authorLink.find('picture img').attr('src') || 'N/A';
            recipeDetails.author_location = authorLink.find('.location .mise-icon-text').text().trim() || 'N/A';

            const ingredientsList = [];
            $('#ingredients .ingredient-list ol li').each((_, element) => {
                const ingredientText = $(element).text().trim();
                if (ingredientText) {
                    ingredientsList.push(ingredientText);
                }
            });
            recipeDetails.ingredients = ingredientsList.length > 0 ? ingredientsList : ['N/A'];

            const stepsList = [];
            $('#steps ol.list-none li.step').each((_, element) => {
                const stepNumber = $(element).find('.flex-shrink-0 > div').text().trim();
                const stepText = $(element).find('div[dir="auto"] p').text().trim();
                if (stepText) {
                    stepsList.push({
                        step: stepNumber,
                        instruction: stepText
                    });
                }
            });
            recipeDetails.steps = stepsList.length > 0 ? stepsList : [{step: '1', instruction: 'N/A'}];

            return recipeDetails;

        } catch (error) {
            console.error(`Error fetching details from ${url}:`, error.message);
            return null;
        }
    }

    async search({ query = 'cilok', limit = 10 }) {
        try {
            const response = await this.client.get(`/id/cari/${encodeURIComponent(query)}`);
            const html = response.data;
            const $ = cheerio.load(html);

            const searchResultsContainer = $('ul#search-recipes-list');
            
            let total = 0;
            const trackingParamsValue = searchResultsContainer.attr('data-search-tracking-params-value');
            if (trackingParamsValue) {
                try {
                    const params = JSON.parse(trackingParamsValue);
                    total = parseInt(params.total_hits, 10) || 0;
                } catch (parseError) {
                    total = searchResultsContainer.find('li[id^="recipe_"]').length;
                }
            } else {
                total = searchResultsContainer.find('li[id^="recipe_"]').length;
            }

            const initialRecipes = [];
            searchResultsContainer.find('li[id^="recipe_"]').each((index, element) => {
                if (initialRecipes.length >= limit) {
                    return false;
                }

                const el = $(element);

                const title = el.find('h2 a.block-link__main').text().trim() || 'N/A';
                
                let link = el.find('h2 a.block-link__main').attr('href') || '';
                if (link && !link.startsWith('http')) {
                    link = `https://cookpad.com${link}`;
                }

                let ingredientsArray = [];
                const ingredientsAttrValue = el.find('div[data-controller="ingredients-highlighter"]')
                                             .attr('data-ingredients-highlighter-ingredients-value');
                if (ingredientsAttrValue) {
                    try {
                        ingredientsArray = JSON.parse(ingredientsAttrValue);
                    } catch (e) {
                        const ingredientsText = el.find('div[data-ingredients-redesign-target="ingredients"] div.line-clamp-3').text().trim();
                        if (ingredientsText) {
                           ingredientsArray = ingredientsText.split('•').map(ing => ing.trim()).filter(ing => ing);
                        } else {
                           ingredientsArray = ['N/A'];
                        }
                    }
                } else {
                     const ingredientsText = el.find('div[data-ingredients-redesign-target="ingredients"] div.line-clamp-3').text().trim();
                     if (ingredientsText) {
                        ingredientsArray = ingredientsText.split('•').map(ing => ing.trim()).filter(ing => ing);
                     } else {
                        ingredientsArray = ['N/A'];
                     }
                }

                const authorName = el.find('div.flex.items-center span.break-all span').first().text().trim() || 'N/A';
                
                const authorAvatarElement = el.find('div.flex.items-center picture img');
                const authorAvatar = authorAvatarElement.attr('src') || '';

                const recipeImageElement = el.find('div.flex-none picture img');
                let recipeImage = recipeImageElement.attr('src') || '';
                
                const webpSourceSet = el.find('div.flex-none picture source[type="image/webp"]').attr('srcset');
                if (webpSourceSet) {
                    recipeImage = webpSourceSet.split(',')[0].trim().split(' ')[0];
                }

                initialRecipes.push({
                    id: el.attr('id')?.replace('recipe_', '') || null,
                    title: title,
                    url: link,
                    ingredients: ingredientsArray,
                    author: authorName,
                    author_avatar: authorAvatar,
                    image: recipeImage
                });
            });

            // Get details for each recipe
            const detailedRecipes = [];
            for (const recipe of initialRecipes) {
                const details = await this.getRecipeDetails(recipe.url);
                if (details) {
                    detailedRecipes.push({
                        ...recipe,
                        details: details
                    });
                }
                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            return {
                status: 'success',
                query: query,
                total_results: total,
                results_returned: detailedRecipes.length,
                recipes: detailedRecipes
            };

        } catch (error) {
            console.error(`Error searching for "${query}":`, error.message);
            return {
                status: 'error',
                message: error.message,
                query: query,
                total_results: 0,
                recipes: []
            };
        }
    }
}

// Create Express app
const app = express();
const port = process.env.PORT || 3000;
const scraper = new CookpadScraper();

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.json({
        message: 'Cookpad Scraper API',
        endpoints: {
            search: '/search?query=FOOD_NAME&limit=NUMBER',
            recipe: '/recipe?url=RECIPE_URL'
        }
    });
});

app.get('/search', async (req, res) => {
    try {
        const query = req.query.query || 'nasi goreng';
        const limit = parseInt(req.query.limit) || 5;
        
        if (limit > 10) {
            return res.status(400).json({
                status: 'error',
                message: 'Maximum limit is 10'
            });
        }

        const results = await scraper.search({ query, limit });
        res.json(results);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

app.get('/recipe', async (req, res) => {
    try {
        const url = req.query.url;
        
        if (!url) {
            return res.status(400).json({
                status: 'error',
                message: 'URL parameter is required'
            });
        }

        const details = await scraper.getRecipeDetails(url);
        
        if (!details) {
            return res.status(404).json({
                status: 'error',
                message: 'Recipe not found'
            });
        }

        res.json({
            status: 'success',
            url: url,
            recipe: details
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
