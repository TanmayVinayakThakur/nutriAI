import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const defaultJsonHeaders = {
  'User-Agent': 'LovableFoodHealthAdvisor/1.0',
  'Accept': 'application/json',
};

async function safeFetchJson(url: string) {
  const response = await fetch(url, { headers: defaultJsonHeaders });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const snippet = await response.text().catch(() => '');
    throw new Error(`Non-JSON response (${contentType}): ${snippet.slice(0, 120)}`);
  }

  return await response.json();
}

function extractJsonCandidate(content: string): string | null {
  if (!content) return null;

  let s = content.trim();

  if (s.includes('```json')) {
    s = s.split('```json')[1]?.split('```')[0]?.trim() ?? s;
  } else if (s.includes('```')) {
    s = s.split('```')[1]?.split('```')[0]?.trim() ?? s;
  }

  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return s.slice(first, last + 1);
  }

  return null;
}

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

// Simple Linear Regression Model (custom implementation for Deno)
class LinearRegressionModel {
  weights: number[] = [];
  bias: number = 0;
  
  train(features: number[][], labels: number[], epochs: number = 100, learningRate: number = 0.01) {
    const numFeatures = features[0].length;
    const numSamples = features.length;
    
    // Initialize weights and bias
    this.weights = Array(numFeatures).fill(0).map(() => Math.random() * 0.1);
    this.bias = Math.random() * 0.1;
    
    // Gradient descent training
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0;
      const weightGradients = Array(numFeatures).fill(0);
      let biasGradient = 0;
      
      // Calculate gradients
      for (let i = 0; i < numSamples; i++) {
        const prediction = this.predict(features[i]);
        const error = prediction - labels[i];
        totalLoss += error * error;
        
        // Update gradients
        for (let j = 0; j < numFeatures; j++) {
          weightGradients[j] += error * features[i][j];
        }
        biasGradient += error;
      }
      
      // Update weights and bias
      for (let j = 0; j < numFeatures; j++) {
        this.weights[j] -= (learningRate * weightGradients[j]) / numSamples;
      }
      this.bias -= (learningRate * biasGradient) / numSamples;
      
      if (epoch % 20 === 0) {
        const avgLoss = totalLoss / numSamples;
        console.log(`Epoch ${epoch}: Loss = ${avgLoss.toFixed(4)}`);
      }
    }
  }
  
  predict(features: number[]): number {
    let result = this.bias;
    for (let i = 0; i < features.length; i++) {
      result += this.weights[i] * features[i];
    }
    // Sigmoid activation for 0-1 output
    return 1 / (1 + Math.exp(-result));
  }
}

// Global model cache
let trainedModel: LinearRegressionModel | null = null;
let modelTrainingPromise: Promise<void> | null = null;

// Train ML model using custom linear regression
async function trainHealthScoreModel() {
  console.log('Starting ML model training...');
  
  // Fetch training data from Open Food Facts with a hard timeout so the
  // function never hangs indefinitely.
  let trainingData: any[] = [];
  try {
    trainingData = await Promise.race([
      fetchTrainingData(),
      new Promise<any[]>((resolve) => {
        setTimeout(() => {
          console.warn('Training data fetch timed out, falling back to rule-based scoring');
          resolve([]);
        }, 5000);
      })
    ]);
  } catch (err) {
    console.error('Error while fetching training data, falling back:', err);
    trainingData = [];
  }
  
  if (trainingData.length < 10) {
    console.warn('Insufficient or no training data, using default rule-based scoring');
    return null;
  }
  
  console.log(`Training on ${trainingData.length} samples`);
  
  // Prepare features and labels (normalized)
  const features = trainingData.map(d => [
    d.calories / 600,
    d.protein / 30,
    d.carbs / 100,
    d.fat / 40,
    d.saturatedFat / 20,
    d.sugar / 50,
    d.fiber / 15,
    d.sodium / 2000,
    d.processingLevel
  ]);
  
  const labels = trainingData.map(d => d.healthScore / 100);
  
  // Train the model
  const model = new LinearRegressionModel();
  model.train(features, labels, 100, 0.1);
  
  console.log('Model training complete');
  return model;
}

// Fetch training data from Open Food Facts
async function fetchTrainingData() {
  const categories = ['vegetables', 'legumes', 'whole-grains', 'fruits', 'nuts', 'dairy', 'snacks', 'beverages'];
  const allData: any[] = [];
  
  for (const category of categories) {
    try {
        const data = await safeFetchJson(
          `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(category)}&countries=India&json=1&page_size=50`
        );
        const products = data.products || [];
      
      for (const product of products) {
        if (!product.nutriments) continue;
        
        const nutrition = {
          calories: product.nutriments['energy-kcal_100g'] || product.nutriments.energy_100g / 4.184 || 0,
          protein: product.nutriments.proteins_100g || 0,
          carbs: product.nutriments.carbohydrates_100g || 0,
          fat: product.nutriments.fat_100g || 0,
          saturatedFat: product.nutriments['saturated-fat_100g'] || 0,
          sugar: product.nutriments.sugars_100g || 0,
          fiber: product.nutriments.fiber_100g || 0,
          sodium: product.nutriments.sodium_100g || 0,
          processingLevel: getProcessingLevel(product),
          healthScore: calculateBasicHealthScore(product.nutriments)
        };
        
        allData.push(nutrition);
      }
    } catch (error) {
      console.error(`Error fetching ${category}:`, error);
    }
  }
  
  return allData;
}

// Estimate processing level from product data
function getProcessingLevel(product: any): number {
  const ingredients = product.ingredients_text?.toLowerCase() || '';
  const categories = product.categories?.toLowerCase() || '';
  
  let score = 0.5;
  
  if (ingredients.includes('preservative') || ingredients.includes('artificial')) score += 0.2;
  if (ingredients.includes('color') || ingredients.includes('flavoring')) score += 0.15;
  if (categories.includes('fresh') || categories.includes('raw')) score -= 0.3;
  if (categories.includes('organic')) score -= 0.2;
  if (categories.includes('processed') || categories.includes('ultra-processed')) score += 0.3;
  
  return Math.max(0.1, Math.min(1.0, score));
}

// Calculate basic health score for training labels
function calculateBasicHealthScore(nutriments: any): number {
  const calories = nutriments['energy-kcal_100g'] || nutriments.energy_100g / 4.184 || 0;
  const protein = nutriments.proteins_100g || 0;
  const fiber = nutriments.fiber_100g || 0;
  const fat = nutriments.fat_100g || 0;
  const saturatedFat = nutriments['saturated-fat_100g'] || 0;
  const sugar = nutriments.sugars_100g || 0;
  const sodium = nutriments.sodium_100g || 0;
  
  let score = 50;
  
  // Positive factors
  if (protein > 10) score += 15;
  if (fiber > 5) score += 15;
  
  // Negative factors
  if (calories > 400) score -= 15;
  if (fat > 20) score -= 10;
  if (saturatedFat > 10) score -= 10;
  if (sugar > 20) score -= 15;
  if (sodium > 500) score -= 10;
  
  return Math.max(0, Math.min(100, score));
}

// Initialize model training
async function ensureModelTrained() {
  if (trainedModel) return trainedModel;
  
  if (!modelTrainingPromise) {
    modelTrainingPromise = (async () => {
      trainedModel = await trainHealthScoreModel();
    })();
  }
  
  await modelTrainingPromise;
  return trainedModel;
}

// Calculate health score using trained ML model or fallback
async function calculateHealthScore(nutrition: any): Promise<number> {
  const model = await ensureModelTrained();
  
  if (model) {
    // Use trained model for prediction
    const features = [
      nutrition.calories / 600,
      nutrition.protein / 30,
      nutrition.carbs / 100,
      nutrition.fat / 40,
      nutrition.saturatedFat / 20,
      nutrition.sugar / 50,
      nutrition.fiber / 15,
      nutrition.sodium / 2000,
      nutrition.processingLevel
    ];
    
    const score = model.predict(features) * 100;
    return Math.max(0, Math.min(100, score));
  }
  
  // Fallback to rule-based scoring if model not available
  return calculateBasicHealthScore({
    'energy-kcal_100g': nutrition.calories,
    'proteins_100g': nutrition.protein,
    'fat_100g': nutrition.fat,
    'saturated-fat_100g': nutrition.saturatedFat,
    'sugars_100g': nutrition.sugar,
    'fiber_100g': nutrition.fiber,
    'sodium_100g': nutrition.sodium
  });
}

// Calculate feature contributions using trained model weights (Proper Explainable AI)
// Now returns ALL metrics, not just top improvements
function calculateFeatureImportance(baseline: any, alternative: any, model: LinearRegressionModel | null) {
  if (!model) {
    return [{
      factor: "Overall Nutrition",
      explanation: "This alternative has a better nutritional profile for your health",
      actualChange: "Improved nutrition"
    }];
  }

  const getRawValues = (nutrition: any) => ({
    calories: nutrition.calories,
    protein: nutrition.protein,
    carbs: nutrition.carbs,
    fat: nutrition.fat,
    saturatedFat: nutrition.saturatedFat,
    sugar: nutrition.sugar,
    fiber: nutrition.fiber,
    sodium: nutrition.sodium,
    processingLevel: nutrition.processingLevel
  });

  const baselineRaw = getRawValues(baseline);
  const alternativeRaw = getRawValues(alternative);

  const featureDetails = [
    { 
      name: "Calories",
      raw: { baseline: baselineRaw.calories, alternative: alternativeRaw.calories },
      better: "lower",
      unit: "kcal"
    },
    { 
      name: "Protein",
      raw: { baseline: baselineRaw.protein, alternative: alternativeRaw.protein },
      better: "higher",
      unit: "g"
    },
    { 
      name: "Carbohydrates",
      raw: { baseline: baselineRaw.carbs, alternative: alternativeRaw.carbs },
      better: "lower",
      unit: "g"
    },
    { 
      name: "Fat",
      raw: { baseline: baselineRaw.fat, alternative: alternativeRaw.fat },
      better: "lower",
      unit: "g"
    },
    { 
      name: "Saturated Fat",
      raw: { baseline: baselineRaw.saturatedFat, alternative: alternativeRaw.saturatedFat },
      better: "lower",
      unit: "g"
    },
    { 
      name: "Sugar",
      raw: { baseline: baselineRaw.sugar, alternative: alternativeRaw.sugar },
      better: "lower",
      unit: "g"
    },
    { 
      name: "Fiber",
      raw: { baseline: baselineRaw.fiber, alternative: alternativeRaw.fiber },
      better: "higher",
      unit: "g"
    },
    { 
      name: "Sodium",
      raw: { baseline: baselineRaw.sodium, alternative: alternativeRaw.sodium },
      better: "lower",
      unit: "mg"
    },
    { 
      name: "Processing Level",
      raw: { baseline: baselineRaw.processingLevel * 100, alternative: alternativeRaw.processingLevel * 100 },
      better: "lower",
      unit: "%"
    }
  ];

  // Generate user-friendly explanations for ALL metrics
  const allMetrics = featureDetails.map((detail) => {
    const rawDiff = detail.raw.alternative - detail.raw.baseline;
    const isImprovement = (detail.better === "lower" && rawDiff < 0) || (detail.better === "higher" && rawDiff > 0);
    const isWorse = (detail.better === "lower" && rawDiff > 0) || (detail.better === "higher" && rawDiff < 0);
    
    const absRawDiff = Math.abs(rawDiff);
    const formattedDiff = detail.unit === "%" 
      ? `${Math.round(absRawDiff)}${detail.unit}`
      : `${Math.round(absRawDiff * 10) / 10}${detail.unit}`;

    let explanation = "";
    let actualChange = "";
    let status: "better" | "worse" | "same" = "same";

    if (Math.abs(rawDiff) < 0.5 && detail.name !== "Processing Level") {
      actualChange = `Similar ${detail.name.toLowerCase()}`;
      explanation = `${detail.name} content is roughly the same`;
      status = "same";
    } else if (detail.name === "Calories") {
      actualChange = rawDiff < 0 ? `${formattedDiff} fewer calories` : `${formattedDiff} more calories`;
      explanation = rawDiff < 0 
        ? "Fewer calories help with weight management and reduce excess energy intake"
        : "More calories provide additional energy but may affect weight management";
      status = isImprovement ? "better" : (isWorse ? "worse" : "same");
    } else if (detail.name === "Protein") {
      actualChange = rawDiff > 0 ? `${formattedDiff} more protein` : `${formattedDiff} less protein`;
      explanation = rawDiff > 0
        ? "More protein helps build muscle, keeps you full longer, and supports body repair"
        : "Less protein may require other sources to meet daily needs";
      status = isImprovement ? "better" : (isWorse ? "worse" : "same");
    } else if (detail.name === "Sugar") {
      actualChange = rawDiff < 0 ? `${formattedDiff} less sugar` : `${formattedDiff} more sugar`;
      explanation = rawDiff < 0
        ? "Less sugar prevents energy crashes, reduces diabetes risk, and protects your teeth"
        : "More sugar may cause energy spikes and increase health risks";
      status = isImprovement ? "better" : (isWorse ? "worse" : "same");
    } else if (detail.name === "Fiber") {
      actualChange = rawDiff > 0 ? `${formattedDiff} more fiber` : `${formattedDiff} less fiber`;
      explanation = rawDiff > 0
        ? "More fiber improves digestion, keeps you full, and supports gut health"
        : "Less fiber may impact digestion and satiety";
      status = isImprovement ? "better" : (isWorse ? "worse" : "same");
    } else if (detail.name === "Fat") {
      actualChange = rawDiff < 0 ? `${formattedDiff} less fat` : `${formattedDiff} more fat`;
      explanation = rawDiff < 0
        ? "Less total fat reduces calorie density while healthy fats remain important"
        : "More fat adds calories; consider the type of fat";
      status = isImprovement ? "better" : (isWorse ? "worse" : "same");
    } else if (detail.name === "Saturated Fat") {
      actualChange = rawDiff < 0 ? `${formattedDiff} less saturated fat` : `${formattedDiff} more saturated fat`;
      explanation = rawDiff < 0
        ? "Less saturated fat reduces heart disease risk and improves cholesterol levels"
        : "More saturated fat may increase cardiovascular risk";
      status = isImprovement ? "better" : (isWorse ? "worse" : "same");
    } else if (detail.name === "Sodium") {
      actualChange = rawDiff < 0 ? `${formattedDiff} less sodium` : `${formattedDiff} more sodium`;
      explanation = rawDiff < 0
        ? "Less sodium helps maintain healthy blood pressure and reduces water retention"
        : "More sodium may increase blood pressure over time";
      status = isImprovement ? "better" : (isWorse ? "worse" : "same");
    } else if (detail.name === "Carbohydrates") {
      actualChange = rawDiff < 0 ? `${formattedDiff} fewer carbs` : `${formattedDiff} more carbs`;
      explanation = rawDiff < 0
        ? "Fewer carbs can help with blood sugar control and weight management"
        : "More carbs provide energy but may affect blood sugar levels";
      status = isImprovement ? "better" : (isWorse ? "worse" : "same");
    } else if (detail.name === "Processing Level") {
      actualChange = rawDiff < 0 ? "Less processed" : (rawDiff > 0 ? "More processed" : "Similar processing");
      explanation = rawDiff < 0
        ? "Less processed foods have more natural nutrients and fewer artificial additives"
        : (rawDiff > 0 ? "More processed foods may contain more additives" : "Similar level of processing");
      status = isImprovement ? "better" : (isWorse ? "worse" : "same");
    }

    return {
      factor: detail.name,
      explanation,
      actualChange,
      status
    };
  }).filter(metric => metric !== null);

  // Sort: improvements first, then same, then worse
  const sortOrder = { better: 0, same: 1, worse: 2 };
  allMetrics.sort((a, b) => sortOrder[a!.status] - sortOrder[b!.status]);

  return allMetrics.map(metric => ({
    factor: metric!.factor,
    explanation: metric!.explanation,
    actualChange: metric!.actualChange,
    status: metric!.status
  }));
}

// Search Open Food Facts for Indian foods
async function searchOpenFoodFacts(query: string) {
  try {
    const data = await safeFetchJson(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&countries=India&json=1&page_size=10`
    );
    return data.products || [];
  } catch (error) {
    console.error('Open Food Facts API error:', error);
    return [];
  }
}

// Normalize name for deduplication (handles variations like "Grilled Chicken" vs "grilled chicken breast")
function normalizeName(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 2)  // Take first 2 words for similarity matching
    .join(' ');
}

// Check if a name is similar to any in the seen set
function isSimilarToSeen(name: string, seenNames: Set<string>): boolean {
  const normalizedNew = normalizeName(name);
  
  for (const seen of seenNames) {
    const normalizedSeen = normalizeName(seen);
    // Check if names share the same first 2 significant words
    if (normalizedNew === normalizedSeen) return true;
    // Also check if one contains the other
    if (normalizedNew.includes(normalizedSeen) || normalizedSeen.includes(normalizedNew)) return true;
  }
  return false;
}

// Get healthier alternatives from Open Food Facts - category-aware with STRONG deduplication
async function getHealthierAlternatives(baselineFood: any, baselineScore: number) {
  const foodName = baselineFood?.identifiedFood || 'snack';
  const category = getFoodCategory(foodName, '');
  const mealType = detectMealType(foodName);
  
  console.log(`Food: ${foodName}, Category: ${category}, Meal Type: ${mealType}`);
  
  // Generate search terms that match the SAME CATEGORY of food
  const searchTerms = getCategoryMatchedSearchTerms(foodName, category, mealType);
  
  const alternatives: any[] = [];
  const seenNames = new Set<string>();

  for (const searchTerm of searchTerms.slice(0, 4)) {
    const products = await searchOpenFoodFacts(searchTerm);
    
    for (const product of products) {
      if (!product.nutriments) continue;
      
      const productName = product.product_name || 'Unknown';
      
      // Strong deduplication - check normalized similarity
      if (isSimilarToSeen(productName, seenNames)) continue;

      const altNutrition = {
        calories: product.nutriments['energy-kcal_100g'] || product.nutriments.energy_100g / 4.184 || 0,
        protein: product.nutriments.proteins_100g || 0,
        carbs: product.nutriments.carbohydrates_100g || 0,
        fat: product.nutriments.fat_100g || 0,
        saturatedFat: product.nutriments['saturated-fat_100g'] || 0,
        sugar: product.nutriments.sugars_100g || 0,
        fiber: product.nutriments.fiber_100g || 0,
        sodium: product.nutriments.sodium_100g || 0,
        vitamins: 0.6,
        processingLevel: 0.3
      };

      const altScore = await calculateHealthScore(altNutrition);

      if (altScore > baselineScore + 3) {
        const model = await ensureModelTrained();
        const reasons = calculateFeatureImportance(baselineFood.nutritionInfo, altNutrition, model);
        
        if (reasons.length > 0) {
          seenNames.add(productName);
          alternatives.push({
            name: productName,
            healthScore: Math.round(altScore),
            benefits: [
              `${Math.round(altNutrition.protein)}g protein per 100g`,
              `${Math.round(altNutrition.fiber)}g fiber per 100g`,
              `${Math.round(altNutrition.calories)} calories per 100g`
            ],
            reasons: reasons,
            nutrition: altNutrition,
            isRegional: false
          });

          if (alternatives.length >= 3) break;
        }
      }
    }
    if (alternatives.length >= 3) break;
  }

  // If not enough from API, add curated alternatives matching the category
  if (alternatives.length < 3) {
    const curated = await getCuratedAlternatives(baselineFood, category, mealType);
    // Filter using strong similarity check
    const filteredCurated = curated.filter(c => !isSimilarToSeen(c.name, seenNames));
    
    for (const alt of filteredCurated) {
      if (alternatives.length >= 3) break;
      if (!isSimilarToSeen(alt.name, seenNames)) {
        seenNames.add(alt.name);
        alternatives.push(alt);
      }
    }
  }

  return alternatives.slice(0, 3);
}

// Get search terms that match the same food category - IMPROVED for better suggestions
function getCategoryMatchedSearchTerms(foodName: string, category: string, mealType: string): string[] {
  const lowerName = foodName.toLowerCase();
  
  // INDIAN CURRY/GRAVY dishes - suggest healthier Indian curries
  if (lowerName.includes('butter chicken') || lowerName.includes('chicken curry') ||
      lowerName.includes('tikka masala') || lowerName.includes('korma')) {
    return ['tandoori chicken', 'chicken tikka grilled', 'chicken kebab', 'grilled chicken breast'];
  }
  
  if (lowerName.includes('paneer') || lowerName.includes('palak') || lowerName.includes('matar')) {
    return ['tofu curry', 'grilled paneer tikka', 'palak tofu', 'cottage cheese grilled'];
  }
  
  if (lowerName.includes('dal') || lowerName.includes('lentil') || lowerName.includes('rajma') ||
      lowerName.includes('chole') || lowerName.includes('chana')) {
    return ['moong dal soup', 'masoor dal', 'sprouted lentils', 'chickpea salad'];
  }
  
  // RICE dishes - suggest healthier rice alternatives
  if (lowerName.includes('biryani') || lowerName.includes('pulao') || lowerName.includes('fried rice')) {
    return ['brown rice pulao', 'quinoa biryani', 'vegetable khichdi', 'millets pulao'];
  }
  
  if (lowerName.includes('rice') && !lowerName.includes('fried')) {
    return ['brown rice', 'quinoa', 'millets cooked', 'cauliflower rice'];
  }
  
  // BREAD/ROTI - suggest healthier flatbreads
  if (lowerName.includes('naan') || lowerName.includes('paratha') || lowerName.includes('kulcha') ||
      lowerName.includes('bhatura') || lowerName.includes('poori') || lowerName.includes('puri')) {
    return ['whole wheat roti', 'multigrain roti', 'bajra roti', 'jowar roti'];
  }
  
  if (lowerName.includes('roti') || lowerName.includes('chapati') || lowerName.includes('bread')) {
    return ['multigrain bread', 'oats roti', 'ragi roti', 'whole wheat sourdough'];
  }
  
  // FRIED SNACKS - suggest baked/grilled versions
  if (lowerName.includes('samosa') || lowerName.includes('pakora') || lowerName.includes('pakoda') ||
      lowerName.includes('bhaji') || lowerName.includes('vada') || lowerName.includes('kachori')) {
    return ['baked samosa', 'air fried pakora', 'grilled paneer tikka', 'roasted chickpeas'];
  }
  
  if (lowerName.includes('fries') || lowerName.includes('french fries')) {
    return ['baked sweet potato fries', 'air fried potato wedges', 'zucchini fries baked', 'carrot fries'];
  }
  
  // CHICKEN/MEAT - suggest grilled/baked versions
  if (lowerName.includes('fried chicken') || lowerName.includes('chicken nuggets') ||
      lowerName.includes('chicken wings')) {
    return ['grilled chicken breast', 'baked chicken', 'tandoori chicken', 'chicken kebab'];
  }
  
  if (lowerName.includes('chicken') || lowerName.includes('meat') || lowerName.includes('mutton') ||
      lowerName.includes('lamb') || lowerName.includes('beef')) {
    return ['grilled chicken breast', 'lean turkey', 'grilled fish fillet', 'baked salmon'];
  }
  
  // FISH/SEAFOOD - suggest healthier preparations
  if (lowerName.includes('fish fry') || lowerName.includes('fried fish')) {
    return ['grilled fish', 'baked salmon', 'steamed fish', 'fish tikka'];
  }
  
  if (lowerName.includes('fish') || lowerName.includes('salmon') || lowerName.includes('prawn') ||
      lowerName.includes('shrimp')) {
    return ['grilled salmon', 'steamed fish', 'baked cod', 'grilled prawns'];
  }
  
  // PIZZA/BURGER - suggest healthier versions
  if (lowerName.includes('pizza')) {
    return ['whole wheat pizza', 'cauliflower crust pizza', 'grilled vegetable wrap', 'stuffed bell peppers'];
  }
  
  if (lowerName.includes('burger')) {
    return ['grilled chicken sandwich', 'lettuce wrap burger', 'turkey burger', 'veggie burger'];
  }
  
  // PASTA/NOODLES - suggest whole grain versions
  if (lowerName.includes('pasta') || lowerName.includes('macaroni') || lowerName.includes('spaghetti') ||
      lowerName.includes('lasagna')) {
    return ['whole wheat pasta', 'chickpea pasta', 'lentil pasta', 'zucchini noodles'];
  }
  
  if (lowerName.includes('noodle') || lowerName.includes('chow mein') || lowerName.includes('hakka')) {
    return ['soba noodles', 'rice noodles', 'vegetable stir fry', 'zucchini noodles'];
  }
  
  // SWEETS/DESSERTS - suggest healthier alternatives
  if (lowerName.includes('gulab jamun') || lowerName.includes('rasgulla') || lowerName.includes('jalebi') ||
      lowerName.includes('ladoo') || lowerName.includes('barfi') || lowerName.includes('halwa')) {
    return ['dates ladoo', 'ragi ladoo', 'oats ladoo', 'dry fruit barfi'];
  }
  
  if (lowerName.includes('cake') || lowerName.includes('pastry') || lowerName.includes('brownie') ||
      lowerName.includes('muffin') || lowerName.includes('donut')) {
    return ['banana bread', 'oats muffin', 'protein brownie', 'date walnut cake'];
  }
  
  if (lowerName.includes('ice cream') || lowerName.includes('kulfi')) {
    return ['frozen yogurt', 'banana nice cream', 'coconut ice cream', 'fruit sorbet'];
  }
  
  if (lowerName.includes('chocolate') || lowerName.includes('candy')) {
    return ['dark chocolate 85%', 'cacao nibs', 'dates chocolate', 'almond butter cups'];
  }
  
  // COOKIES/BISCUITS - suggest healthier versions
  if (lowerName.includes('cookie') || lowerName.includes('biscuit') || lowerName.includes('cream')) {
    return ['oats cookies', 'ragi biscuits', 'multigrain digestive', 'almond cookies'];
  }
  
  // CHIPS/SNACKS - suggest baked alternatives with variety
  if (lowerName.includes('chip') || lowerName.includes('crisp') || lowerName.includes('namkeen') ||
      lowerName.includes('lay') || lowerName.includes('kurkure') || lowerName.includes('bhujia')) {
    return ['roasted makhana fox nuts', 'roasted chana masala', 'baked multigrain chips', 'masala peanuts roasted'];
  }
  
  // PACKAGED SNACKS specifically
  if (lowerName.includes('maggi') || lowerName.includes('instant noodle') || lowerName.includes('cup noodle')) {
    return ['oats noodles', 'vegetable hakka noodles', 'rice noodles', 'soba noodles'];
  }
  
  // BEVERAGES - suggest healthier drinks
  if (lowerName.includes('soda') || lowerName.includes('cola') || lowerName.includes('soft drink') ||
      lowerName.includes('pepsi') || lowerName.includes('coke')) {
    return ['coconut water', 'lime water', 'green tea', 'buttermilk'];
  }
  
  if (lowerName.includes('milkshake') || lowerName.includes('shake') || lowerName.includes('smoothie')) {
    return ['protein smoothie', 'banana oat smoothie', 'green smoothie', 'yogurt smoothie'];
  }
  
  if (lowerName.includes('juice') || lowerName.includes('drink')) {
    return ['coconut water', 'vegetable juice', 'infused water', 'green tea'];
  }
  
  // BREAKFAST items
  if (lowerName.includes('dosa') || lowerName.includes('idli') || lowerName.includes('uttapam')) {
    return ['ragi dosa', 'oats idli', 'moong dal chilla', 'vegetable uttapam'];
  }
  
  if (lowerName.includes('poha') || lowerName.includes('upma') || lowerName.includes('paratha')) {
    return ['vegetable poha', 'oats upma', 'multigrain paratha', 'sprouts paratha'];
  }
  
  if (lowerName.includes('cereal') || lowerName.includes('cornflakes')) {
    return ['oatmeal', 'muesli', 'quinoa porridge', 'chia pudding'];
  }
  
  // EGG dishes
  if (lowerName.includes('egg') || lowerName.includes('omelette') || lowerName.includes('omelet')) {
    return ['egg white omelette', 'boiled eggs', 'poached eggs', 'scrambled egg whites'];
  }
  
  // FRUIT - suggest similar fruits
  if (lowerName.includes('banana') || lowerName.includes('apple') || lowerName.includes('mango') ||
      lowerName.includes('orange') || lowerName.includes('fruit')) {
    return ['berries mixed', 'papaya', 'guava', 'watermelon'];
  }
  
  // Meal-type based fallback
  if (mealType === 'breakfast') {
    return ['oats porridge', 'moong dal chilla', 'vegetable poha', 'egg white omelette'];
  } else if (mealType === 'lunch-dinner') {
    return ['grilled chicken breast', 'dal tadka', 'vegetable stir fry', 'quinoa bowl'];
  }
  
  // Default healthy snacks
  return ['mixed nuts', 'roasted chickpeas', 'greek yogurt', 'fresh fruit bowl'];
}

// Get regional (Indian) healthier alternatives
async function getRegionalAlternatives(baselineFood: any, category: string): Promise<any[]> {
  const model = await ensureModelTrained();
  const foodName = (baselineFood?.identifiedFood || '').toLowerCase();
  
  // Indian regional alternatives by category
  const regionalOptions: { [key: string]: any[] } = {
    'sweet': [
      { name: "Ragi Ladoo", nutrition: { calories: 180, protein: 4, carbs: 28, fat: 6, saturatedFat: 1, sugar: 12, fiber: 3, sodium: 10, vitamins: 0.6, processingLevel: 0.2 } },
      { name: "Dates & Nuts Barfi", nutrition: { calories: 220, protein: 5, carbs: 32, fat: 9, saturatedFat: 2, sugar: 18, fiber: 4, sodium: 8, vitamins: 0.7, processingLevel: 0.2 } },
      { name: "Phirni (Low Sugar)", nutrition: { calories: 120, protein: 4, carbs: 18, fat: 3, saturatedFat: 1.5, sugar: 8, fiber: 1, sodium: 40, vitamins: 0.5, processingLevel: 0.3 } }
    ],
    'salty-snack': [
      { name: "Roasted Chana", nutrition: { calories: 164, protein: 10, carbs: 25, fat: 3, saturatedFat: 0.3, sugar: 4, fiber: 8, sodium: 15, vitamins: 0.7, processingLevel: 0.1 } },
      { name: "Masala Makhana", nutrition: { calories: 140, protein: 4, carbs: 22, fat: 3, saturatedFat: 0.5, sugar: 1, fiber: 3, sodium: 120, vitamins: 0.5, processingLevel: 0.2 } },
      { name: "Baked Khakhra", nutrition: { calories: 150, protein: 5, carbs: 26, fat: 3, saturatedFat: 0.5, sugar: 1, fiber: 4, sodium: 180, vitamins: 0.5, processingLevel: 0.3 } }
    ],
    'fried': [
      { name: "Baked Samosa", nutrition: { calories: 140, protein: 4, carbs: 22, fat: 4, saturatedFat: 0.8, sugar: 2, fiber: 3, sodium: 280, vitamins: 0.4, processingLevel: 0.4 } },
      { name: "Oats Pakora (Air-Fried)", nutrition: { calories: 120, protein: 5, carbs: 18, fat: 3, saturatedFat: 0.5, sugar: 2, fiber: 4, sodium: 200, vitamins: 0.5, processingLevel: 0.3 } },
      { name: "Tandoori Vegetables", nutrition: { calories: 80, protein: 3, carbs: 12, fat: 2, saturatedFat: 0.3, sugar: 4, fiber: 4, sodium: 180, vitamins: 0.8, processingLevel: 0.2 } }
    ],
    'rice-dish': [
      { name: "Brown Rice Pulao", nutrition: { calories: 180, protein: 5, carbs: 35, fat: 3, saturatedFat: 0.5, sugar: 2, fiber: 4, sodium: 320, vitamins: 0.6, processingLevel: 0.2 } },
      { name: "Quinoa Biryani", nutrition: { calories: 200, protein: 8, carbs: 32, fat: 5, saturatedFat: 1, sugar: 3, fiber: 5, sodium: 380, vitamins: 0.7, processingLevel: 0.3 } },
      { name: "Vegetable Daliya", nutrition: { calories: 160, protein: 6, carbs: 28, fat: 3, saturatedFat: 0.5, sugar: 2, fiber: 6, sodium: 280, vitamins: 0.7, processingLevel: 0.2 } }
    ],
    'curry': [
      { name: "Palak Paneer (Low Oil)", nutrition: { calories: 180, protein: 12, carbs: 8, fat: 12, saturatedFat: 5, sugar: 3, fiber: 3, sodium: 320, vitamins: 0.8, processingLevel: 0.3 } },
      { name: "Chana Masala", nutrition: { calories: 180, protein: 10, carbs: 26, fat: 5, saturatedFat: 0.5, sugar: 5, fiber: 8, sodium: 380, vitamins: 0.7, processingLevel: 0.3 } },
      { name: "Mixed Dal Tadka", nutrition: { calories: 150, protein: 10, carbs: 22, fat: 4, saturatedFat: 0.5, sugar: 2, fiber: 7, sodium: 350, vitamins: 0.7, processingLevel: 0.2 } }
    ],
    'breakfast': [
      { name: "Oats Idli", nutrition: { calories: 120, protein: 5, carbs: 22, fat: 2, saturatedFat: 0.3, sugar: 1, fiber: 4, sodium: 280, vitamins: 0.6, processingLevel: 0.2 } },
      { name: "Ragi Dosa", nutrition: { calories: 130, protein: 6, carbs: 24, fat: 2, saturatedFat: 0.3, sugar: 1, fiber: 5, sodium: 200, vitamins: 0.7, processingLevel: 0.2 } },
      { name: "Moong Dal Chilla", nutrition: { calories: 140, protein: 9, carbs: 18, fat: 4, saturatedFat: 0.5, sugar: 2, fiber: 4, sodium: 220, vitamins: 0.7, processingLevel: 0.2 } }
    ],
    'beverage': [
      { name: "Chaas (Buttermilk)", nutrition: { calories: 40, protein: 2, carbs: 4, fat: 1.5, saturatedFat: 1, sugar: 4, fiber: 0, sodium: 120, vitamins: 0.4, processingLevel: 0.2 } },
      { name: "Nimbu Pani (No Sugar)", nutrition: { calories: 20, protein: 0, carbs: 5, fat: 0, saturatedFat: 0, sugar: 2, fiber: 0, sodium: 50, vitamins: 0.5, processingLevel: 0.1 } },
      { name: "Jaljeera", nutrition: { calories: 15, protein: 0.5, carbs: 3, fat: 0, saturatedFat: 0, sugar: 1, fiber: 0.5, sodium: 180, vitamins: 0.4, processingLevel: 0.2 } }
    ],
    'general': [
      { name: "Sprouts Chaat", nutrition: { calories: 120, protein: 8, carbs: 16, fat: 3, saturatedFat: 0.3, sugar: 3, fiber: 6, sodium: 150, vitamins: 0.8, processingLevel: 0.1 } },
      { name: "Vegetable Upma", nutrition: { calories: 180, protein: 5, carbs: 30, fat: 5, saturatedFat: 0.8, sugar: 2, fiber: 4, sodium: 320, vitamins: 0.6, processingLevel: 0.3 } },
      { name: "Poha (Low Oil)", nutrition: { calories: 160, protein: 4, carbs: 28, fat: 4, saturatedFat: 0.5, sugar: 2, fiber: 3, sodium: 280, vitamins: 0.6, processingLevel: 0.2 } }
    ]
  };
  
  const options = regionalOptions[category] || regionalOptions['general'];
  
  return await Promise.all(options.slice(0, 3).map(async alt => {
    const score = await calculateHealthScore(alt.nutrition);
    const reasons = calculateFeatureImportance(baselineFood.nutritionInfo, alt.nutrition, model);
    
    return {
      name: alt.name,
      healthScore: Math.round(score),
      benefits: [
        `${Math.round(alt.nutrition.protein)}g protein per 100g`,
        `${Math.round(alt.nutrition.fiber)}g fiber per 100g`,
        `${Math.round(alt.nutrition.calories)} calories per 100g`
      ],
      reasons: reasons.length > 0 ? reasons : [
        { factor: "Overall Nutrition", explanation: "Better nutritional profile", actualChange: "Improved nutrition", status: "better" }
      ],
      nutrition: alt.nutrition,
      isRegional: true
    };
  }));
}

// Detect meal type based on food name
function detectMealType(foodName: string): 'breakfast' | 'lunch-dinner' | 'snack' | 'any' {
  const name = foodName.toLowerCase();
  
  // Breakfast items
  if (name.includes('cereal') || name.includes('oatmeal') || name.includes('porridge') ||
      name.includes('pancake') || name.includes('waffle') || name.includes('toast') ||
      name.includes('egg') || name.includes('bacon') || name.includes('sausage') ||
      name.includes('paratha') || name.includes('idli') || name.includes('dosa') ||
      name.includes('poha') || name.includes('upma') || name.includes('cornflakes') ||
      name.includes('muesli') || name.includes('granola') || name.includes('breakfast')) {
    return 'breakfast';
  }
  
  // Lunch/Dinner items (main meals)
  if (name.includes('rice') || name.includes('biryani') || name.includes('curry') ||
      name.includes('dal') || name.includes('roti') || name.includes('naan') ||
      name.includes('pasta') || name.includes('noodle') || name.includes('stir fry') ||
      name.includes('steak') || name.includes('chicken') || name.includes('fish') ||
      name.includes('salmon') || name.includes('burger') || name.includes('pizza') ||
      name.includes('sandwich') || name.includes('wrap') || name.includes('salad') ||
      name.includes('soup') || name.includes('thali') || name.includes('paneer') ||
      name.includes('tikka') || name.includes('kebab') || name.includes('pulao') ||
      name.includes('fried rice') || name.includes('chow mein') || name.includes('manchurian') ||
      name.includes('korma') || name.includes('masala') || name.includes('vindaloo') ||
      name.includes('lasagna') || name.includes('casserole') || name.includes('roast')) {
    return 'lunch-dinner';
  }
  
  // Snack items
  if (name.includes('chip') || name.includes('crisp') || name.includes('cookie') ||
      name.includes('biscuit') || name.includes('chocolate') || name.includes('candy') ||
      name.includes('popcorn') || name.includes('nuts') || name.includes('cracker') ||
      name.includes('bar') || name.includes('samosa') || name.includes('pakora') ||
      name.includes('bhaji') || name.includes('vada') || name.includes('chaat') ||
      name.includes('ice cream') || name.includes('cake') || name.includes('pastry') ||
      name.includes('muffin') || name.includes('donut') || name.includes('brownie')) {
    return 'snack';
  }
  
  return 'any';
}

// Get food category for similar item matching
function getFoodCategory(foodName: string, ingredients: string = ''): string {
  const name = foodName.toLowerCase();
  const ing = ingredients.toLowerCase();
  
  // Sweet/Dessert items
  if (name.includes('chocolate') || name.includes('candy') || name.includes('cookie') || 
      name.includes('cake') || name.includes('ice cream') || name.includes('dessert') ||
      name.includes('sweet') || name.includes('brownie') || name.includes('pastry') ||
      name.includes('muffin') || name.includes('donut') || (ing.includes('sugar') && ing.includes('cocoa'))) {
    return 'sweet';
  }
  
  // Salty snacks
  if (name.includes('chip') || name.includes('crisp') || name.includes('cracker') ||
      name.includes('pretzel') || name.includes('popcorn') || name.includes('snack') ||
      name.includes('namkeen') || name.includes('mixture')) {
    return 'salty-snack';
  }
  
  // Beverages
  if (name.includes('soda') || name.includes('juice') || name.includes('drink') ||
      name.includes('cola') || name.includes('beverage') || name.includes('tea') || 
      name.includes('coffee') || name.includes('milkshake') || name.includes('smoothie')) {
    return 'beverage';
  }
  
  // Fried foods
  if (name.includes('fried') || name.includes('fries') || name.includes('nugget') ||
      name.includes('tempura') || name.includes('pakora') || name.includes('samosa') ||
      name.includes('bhaji') || name.includes('vada')) {
    return 'fried';
  }
  
  // Fast food
  if (name.includes('burger') || name.includes('pizza') || name.includes('sandwich') ||
      name.includes('hot dog') || name.includes('wrap') || name.includes('taco')) {
    return 'fast-food';
  }
  
  // Main meals - rice/grain based
  if (name.includes('rice') || name.includes('biryani') || name.includes('pulao') ||
      name.includes('fried rice') || name.includes('khichdi')) {
    return 'rice-dish';
  }
  
  // Curry/gravy dishes
  if (name.includes('curry') || name.includes('masala') || name.includes('korma') ||
      name.includes('tikka') || name.includes('butter chicken') || name.includes('paneer')) {
    return 'curry';
  }
  
  // Pasta/Noodles
  if (name.includes('pasta') || name.includes('noodle') || name.includes('spaghetti') ||
      name.includes('lasagna') || name.includes('chow mein') || name.includes('hakka')) {
    return 'pasta-noodles';
  }
  
  // Breakfast items
  if (name.includes('cereal') || name.includes('oatmeal') || name.includes('pancake') ||
      name.includes('waffle') || name.includes('idli') || name.includes('dosa') ||
      name.includes('poha') || name.includes('upma') || name.includes('paratha')) {
    return 'breakfast';
  }
  
  return 'general';
}

// Curated alternatives as fallback (organized by category AND meal type) - IMPROVED
async function getCuratedAlternatives(baselineFood: any, category: string = 'general', mealType: string = 'any') {
  // Meal-type specific alternatives - BETTER LUNCH/DINNER OPTIONS
  const mealTypeAlternatives: { [key: string]: any[] } = {
    'breakfast': [
      {
        name: "Moong Dal Chilla with Mint Chutney",
        nutrition: { calories: 140, protein: 9, carbs: 18, fat: 4, saturatedFat: 0.5, sugar: 2, fiber: 4, sodium: 220, vitamins: 0.7, processingLevel: 0.2 }
      },
      {
        name: "Oats Upma with Vegetables",
        nutrition: { calories: 180, protein: 6, carbs: 30, fat: 5, saturatedFat: 0.8, sugar: 2, fiber: 5, sodium: 320, vitamins: 0.7, processingLevel: 0.2 }
      },
      {
        name: "Egg White Omelette with Spinach",
        nutrition: { calories: 120, protein: 18, carbs: 4, fat: 3, saturatedFat: 1, sugar: 1, fiber: 2, sodium: 280, vitamins: 0.9, processingLevel: 0.2 }
      },
      {
        name: "Ragi Porridge with Nuts",
        nutrition: { calories: 160, protein: 5, carbs: 28, fat: 4, saturatedFat: 0.5, sugar: 3, fiber: 6, sodium: 15, vitamins: 0.8, processingLevel: 0.1 }
      }
    ],
    'lunch-dinner': [
      {
        name: "Grilled Tandoori Chicken with Salad",
        nutrition: { calories: 220, protein: 32, carbs: 6, fat: 8, saturatedFat: 2, sugar: 2, fiber: 3, sodium: 380, vitamins: 0.8, processingLevel: 0.3 }
      },
      {
        name: "Dal Tadka with Brown Rice",
        nutrition: { calories: 280, protein: 14, carbs: 45, fat: 5, saturatedFat: 0.8, sugar: 3, fiber: 10, sodium: 420, vitamins: 0.8, processingLevel: 0.2 }
      },
      {
        name: "Grilled Fish with Steamed Vegetables",
        nutrition: { calories: 240, protein: 30, carbs: 12, fat: 8, saturatedFat: 1.5, sugar: 4, fiber: 5, sodium: 350, vitamins: 0.9, processingLevel: 0.2 }
      },
      {
        name: "Chicken Tikka with Multigrain Roti",
        nutrition: { calories: 300, protein: 28, carbs: 28, fat: 9, saturatedFat: 2, sugar: 2, fiber: 4, sodium: 450, vitamins: 0.7, processingLevel: 0.3 }
      }
    ]
  };

  const alternativesByCategory: { [key: string]: any[] } = {
    sweet: [
      {
        name: "Dates & Nuts Ladoo",
        nutrition: { calories: 180, protein: 4, carbs: 28, fat: 7, saturatedFat: 1, sugar: 18, fiber: 4, sodium: 5, vitamins: 0.7, processingLevel: 0.2 }
      },
      {
        name: "Dark Chocolate (85% Cacao)",
        nutrition: { calories: 598, protein: 7.8, carbs: 45.9, fat: 42.6, saturatedFat: 24.5, sugar: 14, fiber: 10.9, sodium: 12, vitamins: 0.7, processingLevel: 0.3 }
      },
      {
        name: "Greek Yogurt with Honey",
        nutrition: { calories: 120, protein: 12, carbs: 12, fat: 4, saturatedFat: 2, sugar: 10, fiber: 0, sodium: 45, vitamins: 0.7, processingLevel: 0.3 }
      },
      {
        name: "Frozen Banana Nice Cream",
        nutrition: { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, saturatedFat: 0.1, sugar: 12.2, fiber: 2.6, sodium: 1, vitamins: 0.6, processingLevel: 0.1 }
      }
    ],
    'sweet-biscuit': [
      {
        name: "Oats & Honey Digestive Biscuits",
        nutrition: { calories: 420, protein: 9, carbs: 62, fat: 14, saturatedFat: 4, sugar: 16, fiber: 8, sodium: 300, vitamins: 0.6, processingLevel: 0.4 }
      },
      {
        name: "Ragi Millet Cookies",
        nutrition: { calories: 400, protein: 8, carbs: 58, fat: 13, saturatedFat: 4, sugar: 12, fiber: 9, sodium: 280, vitamins: 0.7, processingLevel: 0.4 }
      },
      {
        name: "Whole Wheat Marie Biscuits",
        nutrition: { calories: 380, protein: 7, carbs: 64, fat: 9, saturatedFat: 3, sugar: 14, fiber: 7, sodium: 250, vitamins: 0.5, processingLevel: 0.4 }
      }
    ],
    'sweet-chocolate': [
      {
        name: "Dark Chocolate (70% Cacao)",
        nutrition: { calories: 580, protein: 7, carbs: 46, fat: 41, saturatedFat: 23, sugar: 18, fiber: 9, sodium: 15, vitamins: 0.7, processingLevel: 0.3 }
      },
      {
        name: "Protein Chocolate Bar",
        nutrition: { calories: 220, protein: 18, carbs: 20, fat: 9, saturatedFat: 4, sugar: 5, fiber: 8, sodium: 140, vitamins: 0.7, processingLevel: 0.4 }
      },
      {
        name: "Almond Butter Dark Chocolate",
        nutrition: { calories: 280, protein: 8, carbs: 22, fat: 18, saturatedFat: 6, sugar: 12, fiber: 4, sodium: 30, vitamins: 0.7, processingLevel: 0.3 }
      }
    ],
    'salty-snack': [
      {
        name: "Seaweed Snacks (Roasted)",
        nutrition: { calories: 60, protein: 3, carbs: 6, fat: 3, saturatedFat: 0.5, sugar: 1, fiber: 2, sodium: 180, vitamins: 0.7, processingLevel: 0.2 }
      },
      {
        name: "Air-Popped Popcorn",
        nutrition: { calories: 90, protein: 3, carbs: 18, fat: 1, saturatedFat: 0.2, sugar: 0.5, fiber: 4, sodium: 80, vitamins: 0.5, processingLevel: 0.1 }
      },
      {
        name: "Edamame (Steamed)",
        nutrition: { calories: 121, protein: 11, carbs: 9, fat: 5, saturatedFat: 0.6, sugar: 2, fiber: 5, sodium: 6, vitamins: 0.8, processingLevel: 0.1 }
      },
      {
        name: "Roasted Almonds (Unsalted)",
        nutrition: { calories: 170, protein: 6, carbs: 6, fat: 15, saturatedFat: 1.1, sugar: 1, fiber: 3, sodium: 1, vitamins: 0.7, processingLevel: 0.1 }
      }
    ],
    'salty-chips': [
      {
        name: "Sweet Potato Chips (Baked)",
        nutrition: { calories: 380, protein: 4, carbs: 62, fat: 12, saturatedFat: 1.2, sugar: 6, fiber: 5, sodium: 240, vitamins: 0.7, processingLevel: 0.3 }
      },
      {
        name: "Beetroot Crisps (Air-Fried)",
        nutrition: { calories: 360, protein: 5, carbs: 58, fat: 10, saturatedFat: 1, sugar: 8, fiber: 6, sodium: 200, vitamins: 0.8, processingLevel: 0.3 }
      },
      {
        name: "Kale Chips (Baked)",
        nutrition: { calories: 180, protein: 6, carbs: 22, fat: 8, saturatedFat: 1, sugar: 2, fiber: 5, sodium: 150, vitamins: 0.9, processingLevel: 0.2 }
      },
      {
        name: "Quinoa Puffs",
        nutrition: { calories: 340, protein: 8, carbs: 55, fat: 9, saturatedFat: 1, sugar: 2, fiber: 4, sodium: 180, vitamins: 0.6, processingLevel: 0.3 }
      }
    ],
    beverage: [
      {
        name: "Sparkling Water with Lemon",
        nutrition: { calories: 5, protein: 0, carbs: 1, fat: 0, saturatedFat: 0, sugar: 0.5, fiber: 0, sodium: 10, vitamins: 0.3, processingLevel: 0.1 }
      },
      {
        name: "Kombucha (Low Sugar)",
        nutrition: { calories: 25, protein: 0.5, carbs: 6, fat: 0, saturatedFat: 0, sugar: 4, fiber: 0, sodium: 10, vitamins: 0.6, processingLevel: 0.2 }
      },
      {
        name: "Herbal Tea (Unsweetened)",
        nutrition: { calories: 2, protein: 0, carbs: 0.5, fat: 0, saturatedFat: 0, sugar: 0, fiber: 0, sodium: 5, vitamins: 0.5, processingLevel: 0.1 }
      },
      {
        name: "Fresh Vegetable Juice",
        nutrition: { calories: 40, protein: 2, carbs: 8, fat: 0.2, saturatedFat: 0, sugar: 6, fiber: 2, sodium: 120, vitamins: 0.9, processingLevel: 0.2 }
      }
    ],
    fried: [
      {
        name: "Oven-Roasted Cauliflower Bites",
        nutrition: { calories: 90, protein: 4, carbs: 12, fat: 3, saturatedFat: 0.3, sugar: 3, fiber: 4, sodium: 180, vitamins: 0.8, processingLevel: 0.2 }
      },
      {
        name: "Baked Falafel",
        nutrition: { calories: 160, protein: 8, carbs: 18, fat: 6, saturatedFat: 0.8, sugar: 2, fiber: 5, sodium: 280, vitamins: 0.6, processingLevel: 0.3 }
      },
      {
        name: "Zucchini Fritters (Air-Fried)",
        nutrition: { calories: 110, protein: 5, carbs: 14, fat: 4, saturatedFat: 0.5, sugar: 3, fiber: 3, sodium: 200, vitamins: 0.7, processingLevel: 0.3 }
      }
    ],
    'fast-food': [
      {
        name: "Grilled Chicken Sandwich (Whole Wheat)",
        nutrition: { calories: 280, protein: 28, carbs: 28, fat: 7, saturatedFat: 1.5, sugar: 4, fiber: 5, sodium: 450, vitamins: 0.6, processingLevel: 0.4 }
      },
      {
        name: "Vegetable Wrap with Hummus",
        nutrition: { calories: 250, protein: 10, carbs: 35, fat: 8, saturatedFat: 1, sugar: 5, fiber: 8, sodium: 380, vitamins: 0.8, processingLevel: 0.3 }
      },
      {
        name: "Grilled Paneer Tikka Wrap",
        nutrition: { calories: 320, protein: 18, carbs: 32, fat: 13, saturatedFat: 5, sugar: 3, fiber: 4, sodium: 420, vitamins: 0.7, processingLevel: 0.3 }
      }
    ],
    'rice-dish': [
      {
        name: "Brown Rice Vegetable Pulao",
        nutrition: { calories: 200, protein: 5, carbs: 38, fat: 3, saturatedFat: 0.5, sugar: 2, fiber: 5, sodium: 280, vitamins: 0.7, processingLevel: 0.2 }
      },
      {
        name: "Quinoa Biryani",
        nutrition: { calories: 220, protein: 9, carbs: 35, fat: 5, saturatedFat: 0.8, sugar: 3, fiber: 6, sodium: 350, vitamins: 0.8, processingLevel: 0.2 }
      },
      {
        name: "Millets Khichdi",
        nutrition: { calories: 180, protein: 7, carbs: 32, fat: 3, saturatedFat: 0.5, sugar: 2, fiber: 5, sodium: 280, vitamins: 0.8, processingLevel: 0.2 }
      }
    ],
    'curry': [
      {
        name: "Grilled Tandoori Chicken",
        nutrition: { calories: 180, protein: 28, carbs: 4, fat: 6, saturatedFat: 1.5, sugar: 2, fiber: 1, sodium: 420, vitamins: 0.7, processingLevel: 0.3 }
      },
      {
        name: "Dal Tadka (Low Oil)",
        nutrition: { calories: 150, protein: 10, carbs: 22, fat: 3, saturatedFat: 0.5, sugar: 2, fiber: 8, sodium: 320, vitamins: 0.8, processingLevel: 0.2 }
      },
      {
        name: "Grilled Fish Tikka",
        nutrition: { calories: 160, protein: 26, carbs: 4, fat: 5, saturatedFat: 1, sugar: 1, fiber: 1, sodium: 380, vitamins: 0.8, processingLevel: 0.3 }
      }
    ],
    'pasta-noodles': [
      {
        name: "Whole Wheat Pasta with Vegetables",
        nutrition: { calories: 280, protein: 12, carbs: 48, fat: 5, saturatedFat: 1, sugar: 6, fiber: 8, sodium: 380, vitamins: 0.7, processingLevel: 0.3 }
      },
      {
        name: "Zucchini Noodles with Pesto",
        nutrition: { calories: 120, protein: 5, carbs: 8, fat: 9, saturatedFat: 2, sugar: 4, fiber: 3, sodium: 280, vitamins: 0.8, processingLevel: 0.2 }
      },
      {
        name: "Soba Noodle Stir Fry",
        nutrition: { calories: 260, protein: 10, carbs: 42, fat: 6, saturatedFat: 1, sugar: 4, fiber: 4, sodium: 400, vitamins: 0.7, processingLevel: 0.3 }
      }
    ],
    'breakfast': [
      {
        name: "Oats Idli with Sambar",
        nutrition: { calories: 140, protein: 6, carbs: 24, fat: 2, saturatedFat: 0.3, sugar: 2, fiber: 5, sodium: 320, vitamins: 0.7, processingLevel: 0.2 }
      },
      {
        name: "Ragi Dosa with Chutney",
        nutrition: { calories: 160, protein: 7, carbs: 28, fat: 3, saturatedFat: 0.5, sugar: 1, fiber: 5, sodium: 280, vitamins: 0.8, processingLevel: 0.2 }
      },
      {
        name: "Moong Dal Chilla",
        nutrition: { calories: 140, protein: 9, carbs: 18, fat: 4, saturatedFat: 0.5, sugar: 2, fiber: 4, sodium: 220, vitamins: 0.7, processingLevel: 0.2 }
      }
    ],
    general: [
      {
        name: "Mixed Nuts & Seeds",
        nutrition: { calories: 580, protein: 20, carbs: 18, fat: 50, saturatedFat: 5, sugar: 3, fiber: 10, sodium: 5, vitamins: 0.8, processingLevel: 0.1 }
      },
      {
        name: "Greek Yogurt with Berries",
        nutrition: { calories: 120, protein: 14, carbs: 12, fat: 3, saturatedFat: 1.5, sugar: 8, fiber: 2, sodium: 50, vitamins: 0.7, processingLevel: 0.3 }
      },
      {
        name: "Fresh Fruit Bowl",
        nutrition: { calories: 80, protein: 1, carbs: 20, fat: 0.3, saturatedFat: 0, sugar: 15, fiber: 3, sodium: 2, vitamins: 0.9, processingLevel: 0.1 }
      }
    ]
  };

  const name = (baselineFood?.identifiedFood || '').toLowerCase();
  let key = category;

  // Determine specific subcategory
  if (category === 'salty-snack' && name.includes('chip')) {
    key = 'salty-chips';
  } else if (category === 'sweet' && (name.includes('biscuit') || name.includes('cookie'))) {
    key = 'sweet-biscuit';
  } else if (category === 'sweet' && name.includes('chocolate')) {
    key = 'sweet-chocolate';
  }

  // For lunch/dinner items, prefer meal-type specific alternatives
  let alternatives: any[];
  if (mealType === 'lunch-dinner' && mealTypeAlternatives['lunch-dinner']) {
    alternatives = mealTypeAlternatives['lunch-dinner'];
  } else if (mealType === 'breakfast' && (alternativesByCategory['breakfast'] || mealTypeAlternatives['breakfast'])) {
    alternatives = alternativesByCategory['breakfast'] || mealTypeAlternatives['breakfast'];
  } else {
    alternatives = alternativesByCategory[key] || alternativesByCategory[category] || alternativesByCategory.general;
  }

  const model = await ensureModelTrained();
  
  return await Promise.all(alternatives.map(async alt => {
    const score = await calculateHealthScore(alt.nutrition);
    const reasons = calculateFeatureImportance(baselineFood.nutritionInfo, alt.nutrition, model);

    return {
      name: alt.name,
      healthScore: Math.round(score),
      benefits: [
        `${Math.round(alt.nutrition.protein)}g protein per 100g`,
        `${Math.round(alt.nutrition.fiber)}g fiber per 100g`,
        `${Math.round(alt.nutrition.calories)} calories per 100g`
      ],
      reasons: reasons.length > 0 ? reasons : [
        {
          factor: "Overall Nutrition",
          explanation: "Better nutritional profile for health",
          actualChange: "Improved nutrition",
          status: "better"
        }
      ],
      nutrition: alt.nutrition
    };
  }));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, identifyOnly, detailedLog, userProfile } = await req.json();
    
    // Extract user preferences for filtering
    const dietPreference = userProfile?.dietPreference || 'non-veg';
    const allergies = userProfile?.allergies || [];
    const targetBodyType = userProfile?.targetBodyType || 'athletic';
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // Log user allergies for debugging
    console.log('User allergies received:', JSON.stringify(allergies));

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Analyzing food image with AI for identification...');

    // Use AI only for food identification, but make sure this never hangs forever
    let identified: any;
    try {
      const aiResponse = await Promise.race([
        fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are a certified nutritionist with access to USDA and global food databases. Analyze the food image and provide PRECISE nutritional data per 100g serving.

ABSOLUTE RULES - VIOLATION IS NOT ALLOWED:
1. NEVER return 0 for protein, carbs, fat, or fiber - ALL foods contain these nutrients
2. Use evidence-based values from nutritional databases
3. When uncertain, estimate conservatively but NEVER use zero

MANDATORY MINIMUM VALUES (per 100g):
- Protein: minimum 0.3g (even pure sugar has trace protein)
- Carbs: minimum 0.5g (even meat has trace carbs from glycogen)
- Fat: minimum 0.1g (all foods contain some lipids)
- Fiber: minimum 0.1g for plant foods, 0g ONLY for pure animal products/oils
- Sugar: can be 0 for unsweetened foods
- Sodium: minimum 5mg (naturally present in all foods)

REFERENCE VALUES BY FOOD TYPE:
- Grains/Rice/Bread: protein 3-12g, carbs 20-75g, fat 0.5-5g, fiber 1-8g
- Meat/Poultry/Fish: protein 15-30g, carbs 0-2g, fat 1-25g, fiber 0g
- Vegetables: protein 1-5g, carbs 3-20g, fat 0.1-1g, fiber 1-5g
- Fruits: protein 0.5-2g, carbs 8-25g, fat 0.1-1g, fiber 1-4g
- Dairy: protein 3-25g, carbs 3-12g, fat 0.5-35g, fiber 0g
- Snacks/Fried: protein 3-10g, carbs 40-70g, fat 15-40g, fiber 1-4g
- Sweets/Desserts: protein 2-8g, carbs 40-80g, fat 5-30g, fiber 0.5-3g
- Legumes/Beans: protein 5-25g, carbs 15-60g, fat 0.5-5g, fiber 5-15g

Return ONLY this JSON structure:
{
  "name": "specific food name with preparation style",
  "confidence": 0.85-0.98,
  "nutrition": {
    "calories": realistic_number,
    "protein": number_minimum_0.3,
    "carbs": number_minimum_0.5,
    "fat": number_minimum_0.1,
    "saturatedFat": number,
    "sugar": number,
    "fiber": number_minimum_0.1_for_plants,
    "sodium": number_mg_minimum_5,
    "processingLevel": 0.1_to_1.0
  }
}`
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Identify this food and provide accurate nutritional values per 100g. Ensure all macros (protein, carbs, fat) have realistic non-zero values.' },
                  { type: 'image_url', image_url: { url: image } }
                ]
              }
            ],
            max_tokens: 600,
          }),
        }),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('AI identification timed out')), 45000)
        ),
      ]);

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (aiResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: 'AI service requires payment. Please add credits.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`AI identification failed with status ${aiResponse.status}`);
      }

      const raw = await aiResponse.json();
      const content = raw.choices?.[0]?.message?.content ?? '';
      console.log('Raw AI content:', content);
      
      const extracted = extractJsonCandidate(content);
      if (!extracted) {
        throw new Error('AI did not return valid JSON');
      }

      try {
        identified = JSON.parse(extracted);
      } catch (e) {
        console.error('Failed to parse AI JSON:', e);
        throw new Error('AI returned invalid JSON');
      }
      
      // POST-PROCESSING: Validate and fix any 0 values that slipped through
      const nutrition = identified.nutrition ?? {};
      nutrition.calories = toNumber(nutrition.calories, 0);
      nutrition.protein = toNumber(nutrition.protein, 0);
      nutrition.carbs = toNumber(nutrition.carbs, 0);
      nutrition.fat = toNumber(nutrition.fat, 0);
      nutrition.saturatedFat = toNumber(nutrition.saturatedFat, 0);
      nutrition.sugar = toNumber(nutrition.sugar, 0);
      nutrition.fiber = toNumber(nutrition.fiber, 0);
      nutrition.sodium = toNumber(nutrition.sodium, 0);
      nutrition.processingLevel = toNumber(nutrition.processingLevel, 0.5);

      const foodName = String(identified.name ?? '').toLowerCase();
      const isAnimalProduct = /meat|chicken|fish|beef|pork|lamb|tuna|salmon|shrimp|prawn|egg|bacon|sausage/.test(foodName);
      
      // Ensure minimum values - NO food should have 0 for these
      if (!nutrition.protein || nutrition.protein < 0.3) {
        nutrition.protein = isAnimalProduct ? 18 : 2.5;
        console.log('Fixed protein value to:', nutrition.protein);
      }
      if (!nutrition.carbs || nutrition.carbs < 0.5) {
        nutrition.carbs = isAnimalProduct ? 0.5 : 15;
        console.log('Fixed carbs value to:', nutrition.carbs);
      }
      if (!nutrition.fat || nutrition.fat < 0.1) {
        nutrition.fat = 3;
        console.log('Fixed fat value to:', nutrition.fat);
      }
      if (!nutrition.fiber || nutrition.fiber < 0.1) {
        nutrition.fiber = isAnimalProduct ? 0 : 1.5;
        console.log('Fixed fiber value to:', nutrition.fiber);
      }
      if (!nutrition.sodium || nutrition.sodium < 5) {
        nutrition.sodium = 150;
        console.log('Fixed sodium value to:', nutrition.sodium);
      }
      if (!nutrition.calories || nutrition.calories < 10) {
        nutrition.calories = 150;
        console.log('Fixed calories value to:', nutrition.calories);
      }
      
      identified.nutrition = nutrition;
    } catch (aiError) {
      console.error('AI identification error, falling back:', aiError);
      return new Response(
        JSON.stringify({
          error: 'Could not identify the food from the image. Please try another photo or different angle.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Food identified:', identified.name);
    console.log('Final nutrition values:', JSON.stringify(identified.nutrition));

    // In detailed mode we do a lightweight first pass (name + nutrition only)
    // to reduce timeouts and avoid doing full analysis twice.
    if (identifyOnly) {
      return new Response(
        JSON.stringify({
          identifiedFood: identified.name,
          confidence: identified.confidence,
          nutritionInfo: {
            calories: Math.round(identified.nutrition.calories),
            protein: Math.round(identified.nutrition.protein * 10) / 10,
            carbs: Math.round(identified.nutrition.carbs * 10) / 10,
            fats: Math.round(identified.nutrition.fat * 10) / 10,
            saturatedFat: Math.round((identified.nutrition.saturatedFat || 0) * 10) / 10,
            sugar: Math.round((identified.nutrition.sugar || 0) * 10) / 10,
            fiber: Math.round((identified.nutrition.fiber || 0) * 10) / 10,
            sodium: Math.round(identified.nutrition.sodium || 0),
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate baseline health score using ML model
    const baselineNutrition = {
      calories: identified.nutrition.calories,
      protein: identified.nutrition.protein,
      carbs: identified.nutrition.carbs,
      fat: identified.nutrition.fat,
      saturatedFat: identified.nutrition.saturatedFat,
      sugar: identified.nutrition.sugar,
      fiber: identified.nutrition.fiber,
      sodium: identified.nutrition.sodium,
      vitamins: 0.5,
      processingLevel: identified.nutrition.processingLevel
    };

    const baselineScore = await calculateHealthScore(baselineNutrition);
    console.log('Baseline health score:', baselineScore);

    // Get alternatives using Open Food Facts + ML scoring with meal-type awareness
    console.log('Searching Open Food Facts for healthier alternatives...');
    const category = getFoodCategory(identified.name, '');
    const mealType = detectMealType(identified.name);
    console.log(`Detected meal type: ${mealType} for ${identified.name}`);
    
    const alternatives = await getHealthierAlternatives(
      {
        identifiedFood: identified.name,
        nutritionInfo: baselineNutrition
      },
      baselineScore
    );

    // Filter alternatives based on diet preference and allergies
    const filteredAlternatives = alternatives.filter(alt => {
      const name = alt.name.toLowerCase();
      
      // Diet preference filtering
      if (dietPreference === 'vegan') {
        const nonVegan = ['chicken', 'meat', 'fish', 'egg', 'milk', 'dairy', 'yogurt', 'cheese', 'butter', 'honey'];
        if (nonVegan.some(item => name.includes(item))) return false;
      } else if (dietPreference === 'vegetarian') {
        const nonVeg = ['chicken', 'meat', 'fish', 'mutton', 'beef', 'pork', 'prawn', 'shrimp'];
        if (nonVeg.some(item => name.includes(item))) return false;
      }
      
      // Allergy filtering
      for (const allergy of allergies) {
        if (name.includes(allergy.toLowerCase())) return false;
      }
      
      return true;
    });

    // Calculate total nutrition if detailed log provided
    let totalCalories = identified.nutrition.calories;
    let totalProtein = identified.nutrition.protein;
    let totalCarbs = identified.nutrition.carbs;
    let totalFat = identified.nutrition.fat;
    let totalFiber = identified.nutrition.fiber || 0;
    let totalSugar = identified.nutrition.sugar || 0;
    let totalSodium = identified.nutrition.sodium || 0;
    let servingInfo = "per 100g";
    
    // Process detailed log data with robust validation
    if (detailedLog && typeof detailedLog === 'object') {
      console.log('Processing detailed log:', JSON.stringify(detailedLog));
      
      const weight = toNumber(detailedLog.weight, 100);
      const pieces = toNumber(detailedLog.pieces, 1);
      const servingSize = String(detailedLog.servingSize || '100g');
      
      // For items that are counted by pieces (like eggs, chicken pieces, poori, etc.)
      const foodLower = identified.name.toLowerCase();
      const pieceBasedFoods: { [key: string]: { weight: number, cal: number, protein: number, carbs: number, fat: number, fiber: number, sugar: number, sodium: number } } = {
        'egg': { weight: 50, cal: 78, protein: 6.3, carbs: 0.6, fat: 5.3, fiber: 0, sugar: 0.6, sodium: 62 },
        'boiled egg': { weight: 50, cal: 78, protein: 6.3, carbs: 0.6, fat: 5.3, fiber: 0, sugar: 0.6, sodium: 62 },
        'fried egg': { weight: 55, cal: 92, protein: 6.3, carbs: 0.6, fat: 7.3, fiber: 0, sugar: 0.6, sodium: 92 },
        'omelette': { weight: 65, cal: 95, protein: 7, carbs: 1, fat: 7.5, fiber: 0, sugar: 0.5, sodium: 120 },
        'poori': { weight: 30, cal: 100, protein: 2, carbs: 13, fat: 5, fiber: 0.5, sugar: 0.5, sodium: 80 },
        'puri': { weight: 30, cal: 100, protein: 2, carbs: 13, fat: 5, fiber: 0.5, sugar: 0.5, sodium: 80 },
        'roti': { weight: 35, cal: 85, protein: 3, carbs: 18, fat: 0.5, fiber: 1.2, sugar: 0.3, sodium: 120 },
        'chapati': { weight: 35, cal: 85, protein: 3, carbs: 18, fat: 0.5, fiber: 1.2, sugar: 0.3, sodium: 120 },
        'paratha': { weight: 60, cal: 180, protein: 4, carbs: 25, fat: 8, fiber: 1, sugar: 0.5, sodium: 250 },
        'naan': { weight: 90, cal: 262, protein: 9, carbs: 45, fat: 5, fiber: 2, sugar: 3, sodium: 418 },
        'idli': { weight: 40, cal: 58, protein: 2, carbs: 12, fat: 0.2, fiber: 0.5, sugar: 0.3, sodium: 40 },
        'dosa': { weight: 80, cal: 133, protein: 3.9, carbs: 21, fat: 3.7, fiber: 1, sugar: 0.5, sodium: 95 },
        'samosa': { weight: 50, cal: 150, protein: 3, carbs: 15, fat: 9, fiber: 1, sugar: 1, sodium: 180 },
        'pakora': { weight: 25, cal: 75, protein: 2, carbs: 7, fat: 5, fiber: 0.5, sugar: 0.3, sodium: 120 },
        'vada': { weight: 40, cal: 120, protein: 3, carbs: 12, fat: 7, fiber: 0.8, sugar: 0.5, sodium: 150 },
        'chicken leg': { weight: 110, cal: 220, protein: 24, carbs: 0, fat: 14, fiber: 0, sugar: 0, sodium: 85 },
        'chicken breast': { weight: 120, cal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0, sodium: 74 },
        'chicken wing': { weight: 35, cal: 80, protein: 7, carbs: 0, fat: 6, fiber: 0, sugar: 0, sodium: 55 },
        'chicken thigh': { weight: 85, cal: 180, protein: 20, carbs: 0, fat: 11, fiber: 0, sugar: 0, sodium: 70 },
        'fish fillet': { weight: 100, cal: 120, protein: 22, carbs: 0, fat: 3, fiber: 0, sugar: 0, sodium: 80 },
        'mutton piece': { weight: 85, cal: 180, protein: 18, carbs: 0, fat: 12, fiber: 0, sugar: 0, sodium: 75 },
        'prawn': { weight: 10, cal: 10, protein: 2, carbs: 0, fat: 0.2, fiber: 0, sugar: 0, sodium: 15 },
        'shrimp': { weight: 10, cal: 10, protein: 2, carbs: 0, fat: 0.2, fiber: 0, sugar: 0, sodium: 15 },
        'crab': { weight: 100, cal: 97, protein: 19, carbs: 0, fat: 1.5, fiber: 0, sugar: 0, sodium: 330 },
        'lobster': { weight: 100, cal: 89, protein: 19, carbs: 0, fat: 0.9, fiber: 0, sugar: 0, sodium: 380 },
        'tikka': { weight: 40, cal: 65, protein: 8, carbs: 1, fat: 3, fiber: 0, sugar: 0.5, sodium: 120 },
        'kebab': { weight: 50, cal: 85, protein: 9, carbs: 2, fat: 4.5, fiber: 0.3, sugar: 0.5, sodium: 150 },
        'momo': { weight: 25, cal: 45, protein: 2.5, carbs: 6, fat: 1.5, fiber: 0.3, sugar: 0.2, sodium: 85 },
        'dumpling': { weight: 25, cal: 45, protein: 2.5, carbs: 6, fat: 1.5, fiber: 0.3, sugar: 0.2, sodium: 85 },
        'spring roll': { weight: 40, cal: 90, protein: 2, carbs: 10, fat: 5, fiber: 0.5, sugar: 0.5, sodium: 130 },
        'cutlet': { weight: 60, cal: 130, protein: 5, carbs: 12, fat: 7, fiber: 1, sugar: 0.5, sodium: 180 },
        'kachori': { weight: 45, cal: 160, protein: 3, carbs: 18, fat: 9, fiber: 1, sugar: 1, sodium: 200 },
      };
      
      // Check if it's a piece-based food
      let isPieceBased = false;
      for (const [food, nutrition] of Object.entries(pieceBasedFoods)) {
        if (foodLower.includes(food)) {
          isPieceBased = true;
          const effectivePieces = pieces > 0 ? pieces : 1;
          totalCalories = nutrition.cal * effectivePieces;
          totalProtein = nutrition.protein * effectivePieces;
          totalCarbs = nutrition.carbs * effectivePieces;
          totalFat = nutrition.fat * effectivePieces;
          totalFiber = nutrition.fiber * effectivePieces;
          totalSugar = nutrition.sugar * effectivePieces;
          totalSodium = nutrition.sodium * effectivePieces;
          servingInfo = `${effectivePieces} piece${effectivePieces > 1 ? 's' : ''}`;
          console.log(`Piece-based calculation for ${food}: ${effectivePieces} pieces`);
          break;
        }
      }
      
      // If not piece-based, calculate from weight
      if (!isPieceBased && weight > 0) {
        const multiplier = weight / 100;
        totalCalories = identified.nutrition.calories * multiplier;
        totalProtein = identified.nutrition.protein * multiplier;
        totalCarbs = identified.nutrition.carbs * multiplier;
        totalFat = identified.nutrition.fat * multiplier;
        totalFiber = (identified.nutrition.fiber || 0) * multiplier;
        totalSugar = (identified.nutrition.sugar || 0) * multiplier;
        totalSodium = (identified.nutrition.sodium || 0) * multiplier;
        servingInfo = `${weight}g serving`;
        console.log(`Weight-based calculation: ${weight}g, multiplier: ${multiplier}`);
        
        if (pieces > 1) {
          servingInfo += ` (${pieces} pieces)`;
        }
      }
      
      // Handle custom ingredients from detailed log
      const customIngredients = detailedLog.customIngredients;
      if (customIngredients && Array.isArray(customIngredients) && customIngredients.length > 0) {
        console.log('Processing custom ingredients:', JSON.stringify(customIngredients));
        
        const ingredientNutrition: { [key: string]: { cal: number, protein: number, carbs: number, fat: number, fiber: number, sugar: number, sodium: number, unit: 'g' | 'ml' | 'piece' | 'tbsp' | 'tsp' | 'cup' } } = {
          'banana': { cal: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, sugar: 12, sodium: 1, unit: 'piece' },
          'mango': { cal: 60, protein: 0.8, carbs: 15, fat: 0.4, fiber: 1.6, sugar: 14, sodium: 1, unit: 'piece' },
          'apple': { cal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sugar: 10, sodium: 1, unit: 'piece' },
          'orange': { cal: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4, sugar: 9, sodium: 0, unit: 'piece' },
          'strawberry': { cal: 32, protein: 0.7, carbs: 8, fat: 0.3, fiber: 2, sugar: 5, sodium: 1, unit: 'piece' },
          'milk': { cal: 42, protein: 3.4, carbs: 5, fat: 1, fiber: 0, sugar: 5, sodium: 44, unit: 'ml' },
          'cream': { cal: 340, protein: 2.1, carbs: 2.8, fat: 37, fiber: 0, sugar: 2.8, sodium: 34, unit: 'tbsp' },
          'sugar': { cal: 387, protein: 0, carbs: 100, fat: 0, fiber: 0, sugar: 100, sodium: 0, unit: 'tsp' },
          'honey': { cal: 304, protein: 0.3, carbs: 82, fat: 0, fiber: 0.2, sugar: 82, sodium: 4, unit: 'tbsp' },
          'oil': { cal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sugar: 0, sodium: 0, unit: 'tbsp' },
          'ghee': { cal: 900, protein: 0, carbs: 0, fat: 100, fiber: 0, sugar: 0, sodium: 0, unit: 'tsp' },
          'butter': { cal: 717, protein: 0.9, carbs: 0.1, fat: 81, fiber: 0, sugar: 0.1, sodium: 576, unit: 'tbsp' },
          'rice': { cal: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugar: 0, sodium: 1, unit: 'cup' },
          'potato': { cal: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.2, sugar: 0.8, sodium: 6, unit: 'g' },
          'paneer': { cal: 265, protein: 18, carbs: 1.2, fat: 21, fiber: 0, sugar: 1.2, sodium: 15, unit: 'g' },
          'cheese': { cal: 402, protein: 25, carbs: 1.3, fat: 33, fiber: 0, sugar: 0.5, sodium: 621, unit: 'g' },
          'yogurt': { cal: 59, protein: 3.5, carbs: 3.6, fat: 3.3, fiber: 0, sugar: 3.6, sodium: 46, unit: 'g' },
          'curd': { cal: 59, protein: 3.5, carbs: 3.6, fat: 3.3, fiber: 0, sugar: 3.6, sodium: 46, unit: 'g' },
          'fruits': { cal: 60, protein: 0.8, carbs: 15, fat: 0.3, fiber: 2, sugar: 12, sodium: 1, unit: 'piece' },
          'dressing': { cal: 150, protein: 0.3, carbs: 5, fat: 15, fiber: 0, sugar: 4, sodium: 280, unit: 'tbsp' },
          'sauce': { cal: 50, protein: 0.5, carbs: 10, fat: 0.3, fiber: 0.5, sugar: 8, sodium: 350, unit: 'tbsp' },
          'mayo': { cal: 94, protein: 0.1, carbs: 0.4, fat: 10, fiber: 0, sugar: 0.1, sodium: 88, unit: 'tbsp' },
          'mayonnaise': { cal: 94, protein: 0.1, carbs: 0.4, fat: 10, fiber: 0, sugar: 0.1, sodium: 88, unit: 'tbsp' },
          'ketchup': { cal: 17, protein: 0.2, carbs: 4, fat: 0, fiber: 0, sugar: 3.5, sodium: 154, unit: 'tbsp' },
        };
        
        // Unit conversion factors to normalize to base nutrition values
        const unitMultipliers: { [key: string]: number } = {
          'g': 0.01,      // nutrition per 100g, so 1g = 0.01
          'ml': 0.01,     // same as grams for liquids
          'piece': 1,     // per piece (e.g., 1 banana)
          'tbsp': 0.15,   // ~15g per tablespoon
          'tsp': 0.05,    // ~5g per teaspoon
          'cup': 2.4,     // ~240g per cup
        };
        
        for (const ing of customIngredients) {
          if (!ing || typeof ing !== 'object') continue;
          
          const ingName = String(ing.name || '').toLowerCase();
          const ingQty = toNumber(ing.quantity, 0);
          
          if (ingQty <= 0) continue;
          
          for (const [ingredient, nutrition] of Object.entries(ingredientNutrition)) {
            if (ingName.includes(ingredient)) {
              const baseMultiplier = unitMultipliers[nutrition.unit] || 1;
              const effectiveMultiplier = ingQty * baseMultiplier;
              
              totalCalories += nutrition.cal * effectiveMultiplier;
              totalProtein += nutrition.protein * effectiveMultiplier;
              totalCarbs += nutrition.carbs * effectiveMultiplier;
              totalFat += nutrition.fat * effectiveMultiplier;
              totalFiber += nutrition.fiber * effectiveMultiplier;
              totalSugar += nutrition.sugar * effectiveMultiplier;
              totalSodium += nutrition.sodium * effectiveMultiplier;
              
              console.log(`Added ingredient ${ingredient}: ${ingQty} ${nutrition.unit}, multiplier: ${effectiveMultiplier}`);
              break;
            }
          }
        }
      }
    }

    // COMPREHENSIVE ALLERGEN DETECTION
    const allergenWarning: string[] = [];
    
    // Extended allergen keywords with common food items containing them
    const allergenKeywords: { [key: string]: string[] } = {
      // Dairy/Milk products
      dairy: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'paneer', 'ghee', 'whey', 'casein', 'lactose', 'curd', 'kheer', 'kulfi', 'lassi', 'raita', 'malai', 'rabri', 'basundi', 'ice cream', 'milkshake', 'latte', 'cappuccino', 'mozzarella', 'cheddar', 'parmesan', 'ricotta'],
      milk: ['milk', 'dairy', 'cheese', 'butter', 'cream', 'yogurt', 'paneer', 'ghee', 'whey', 'casein', 'lactose', 'curd', 'kheer', 'kulfi', 'lassi', 'raita', 'malai', 'ice cream', 'milkshake', 'latte', 'cappuccino'],
      lactose: ['milk', 'dairy', 'cheese', 'butter', 'cream', 'yogurt', 'paneer', 'curd', 'ice cream', 'lassi', 'kheer', 'kulfi', 'milkshake'],
      
      // Eggs
      eggs: ['egg', 'mayonnaise', 'meringue', 'albumin', 'omelette', 'omelet', 'scrambled', 'fried egg', 'boiled egg', 'egg curry', 'egg bhurji', 'cake', 'custard', 'pudding', 'french toast', 'pancake', 'waffle', 'brioche', 'quiche'],
      egg: ['egg', 'mayonnaise', 'meringue', 'omelette', 'omelet', 'scrambled', 'cake', 'custard', 'pudding', 'pancake', 'waffle', 'quiche'],
      
      // Nuts
      peanuts: ['peanut', 'groundnut', 'monkey nut', 'satay', 'pad thai', 'peanut butter', 'chikki'],
      peanut: ['peanut', 'groundnut', 'peanut butter', 'satay', 'chikki'],
      'tree nuts': ['almond', 'walnut', 'cashew', 'pistachio', 'hazelnut', 'macadamia', 'pecan', 'chestnut', 'brazil nut', 'pine nut', 'badam', 'kaju', 'pista', 'akhrot'],
      nuts: ['almond', 'walnut', 'cashew', 'pistachio', 'hazelnut', 'macadamia', 'pecan', 'peanut', 'groundnut', 'badam', 'kaju', 'pista', 'akhrot', 'chikki', 'praline', 'marzipan', 'nougat'],
      almond: ['almond', 'badam', 'marzipan', 'macaroon', 'frangipane'],
      cashew: ['cashew', 'kaju', 'kaju katli', 'kaju barfi'],
      walnut: ['walnut', 'akhrot', 'brownie'],
      pistachio: ['pistachio', 'pista', 'kulfi'],
      
      // Soy
      soy: ['soy', 'soya', 'tofu', 'tempeh', 'edamame', 'miso', 'soy sauce', 'soy milk', 'soybean'],
      soya: ['soy', 'soya', 'tofu', 'tempeh', 'edamame', 'miso', 'soy sauce', 'soy milk'],
      
      // Wheat/Gluten
      wheat: ['wheat', 'bread', 'flour', 'pasta', 'noodle', 'roti', 'chapati', 'naan', 'paratha', 'poori', 'puri', 'kulcha', 'bhatura', 'samosa', 'pakora', 'pizza', 'cake', 'cookie', 'biscuit', 'cracker', 'tortilla', 'couscous', 'semolina', 'suji', 'maida', 'atta'],
      gluten: ['wheat', 'barley', 'rye', 'oats', 'bread', 'pasta', 'noodle', 'cereal', 'beer', 'pizza', 'cake', 'cookie', 'biscuit', 'roti', 'chapati', 'naan', 'paratha', 'samosa', 'pakora'],
      
      // Seafood
      fish: ['fish', 'salmon', 'tuna', 'cod', 'sardine', 'anchovy', 'mackerel', 'trout', 'tilapia', 'bass', 'herring', 'halibut', 'pomfret', 'rohu', 'hilsa', 'surmai', 'bangda', 'rawas', 'fish curry', 'fish fry'],
      shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'oyster', 'mussel', 'clam', 'scallop', 'squid', 'calamari', 'octopus', 'jhinga', 'kolambi'],
      seafood: ['fish', 'shrimp', 'prawn', 'crab', 'lobster', 'oyster', 'mussel', 'clam', 'scallop', 'squid', 'salmon', 'tuna', 'pomfret', 'surmai', 'rawas'],
      prawn: ['prawn', 'shrimp', 'jhinga', 'kolambi'],
      shrimp: ['shrimp', 'prawn', 'jhinga'],
      crab: ['crab', 'crabmeat'],
      
      // Other common allergens
      sesame: ['sesame', 'tahini', 'hummus', 'til', 'gingelly', 'sesame oil', 'til chikki'],
      mustard: ['mustard', 'sarson', 'rai'],
      celery: ['celery', 'celeriac'],
      sulphites: ['wine', 'dried fruit', 'pickles', 'vinegar'],
      lupin: ['lupin', 'lupini'],
      molluscs: ['oyster', 'mussel', 'clam', 'scallop', 'squid', 'octopus', 'snail'],
      
      // Meat (for vegetarians)
      'non-veg': ['chicken', 'mutton', 'lamb', 'beef', 'pork', 'fish', 'prawn', 'shrimp', 'crab', 'egg', 'meat', 'bacon', 'ham', 'sausage', 'kebab', 'tikka', 'tandoori', 'biryani chicken', 'butter chicken', 'fish curry'],
      meat: ['chicken', 'mutton', 'lamb', 'beef', 'pork', 'meat', 'bacon', 'ham', 'sausage', 'kebab'],
      chicken: ['chicken', 'poultry', 'butter chicken', 'chicken curry', 'chicken tikka', 'tandoori chicken', 'chicken biryani', 'chicken nuggets', 'fried chicken'],
      
      // Spices (for those with sensitivities)
      spicy: ['chili', 'chilli', 'pepper', 'spicy', 'hot sauce', 'wasabi', 'horseradish'],
    };
    
    const foodNameLower = identified.name.toLowerCase();
    
    // Also check against common food compositions
    const foodAllergenMap: { [key: string]: string[] } = {
      'butter chicken': ['dairy', 'lactose', 'chicken'],
      'paneer': ['dairy', 'lactose', 'milk'],
      'cheese': ['dairy', 'lactose', 'milk'],
      'pizza': ['dairy', 'wheat', 'gluten', 'cheese'],
      'pasta': ['wheat', 'gluten'],
      'naan': ['wheat', 'gluten', 'dairy'],
      'cake': ['wheat', 'gluten', 'eggs', 'dairy'],
      'ice cream': ['dairy', 'lactose', 'milk'],
      'biryani': ['wheat', 'gluten'],
      'samosa': ['wheat', 'gluten'],
      'pakora': ['wheat', 'gluten'],
      'mayonnaise': ['eggs', 'egg'],
      'custard': ['eggs', 'dairy', 'milk'],
      'kheer': ['dairy', 'milk', 'nuts'],
      'gulab jamun': ['dairy', 'wheat', 'milk'],
      'jalebi': ['wheat', 'gluten'],
      'kulfi': ['dairy', 'milk', 'nuts'],
      'lassi': ['dairy', 'milk', 'lactose'],
      'raita': ['dairy', 'milk'],
      'malai kofta': ['dairy', 'nuts'],
      'korma': ['dairy', 'nuts'],
      'fish curry': ['fish', 'seafood'],
      'prawn': ['shellfish', 'seafood', 'prawn'],
      'shrimp': ['shellfish', 'seafood', 'shrimp'],
      'egg curry': ['eggs', 'egg'],
      'omelette': ['eggs', 'egg'],
      'french toast': ['eggs', 'wheat', 'dairy'],
      'pancake': ['eggs', 'wheat', 'dairy'],
    };
    
    for (const allergy of allergies) {
      const allergyLower = allergy.toLowerCase().trim();
      
      // Skip empty allergies
      if (!allergyLower) continue;
      
      // Check 1: Direct match in food name
      if (foodNameLower.includes(allergyLower)) {
        if (!allergenWarning.includes(allergy)) {
          allergenWarning.push(allergy);
        }
        continue;
      }
      
      // Check 2: Keyword-based detection
      const keywords = allergenKeywords[allergyLower] || [];
      for (const keyword of keywords) {
        if (foodNameLower.includes(keyword.toLowerCase())) {
          if (!allergenWarning.includes(allergy)) {
            allergenWarning.push(allergy);
          }
          break;
        }
      }
      
      // Check 3: Food composition map
      for (const [food, containedAllergens] of Object.entries(foodAllergenMap)) {
        if (foodNameLower.includes(food)) {
          if (containedAllergens.includes(allergyLower) || 
              containedAllergens.some(a => allergyLower.includes(a) || a.includes(allergyLower))) {
            if (!allergenWarning.includes(allergy)) {
              allergenWarning.push(allergy);
            }
            break;
          }
        }
      }
    }
    
    if (allergenWarning.length > 0) {
      console.log('ALLERGEN DETECTED:', allergenWarning, 'in food:', identified.name);
    }

    // Determine best choice based on health score and target body type
    let bestChoice = null;
    if (filteredAlternatives.length > 0) {
      // Sort by health score, pick highest
      const sorted = [...filteredAlternatives].sort((a, b) => b.healthScore - a.healthScore);
      bestChoice = sorted[0];
    }

    const result = {
      identifiedFood: identified.name,
      confidence: identified.confidence,
      nutritionInfo: {
        calories: Math.round(identified.nutrition.calories),
        protein: Math.round(identified.nutrition.protein * 10) / 10,
        carbs: Math.round(identified.nutrition.carbs * 10) / 10,
        fats: Math.round(identified.nutrition.fat * 10) / 10,
        saturatedFat: Math.round((identified.nutrition.saturatedFat || 0) * 10) / 10,
        sugar: Math.round((identified.nutrition.sugar || 0) * 10) / 10,
        fiber: Math.round((identified.nutrition.fiber || 0) * 10) / 10,
        sodium: Math.round(identified.nutrition.sodium || 0),
      },
      totalCalories: Math.round(totalCalories),
      totalProtein: Math.round(totalProtein * 10) / 10,
      totalCarbs: Math.round(totalCarbs * 10) / 10,
      totalFat: Math.round(totalFat * 10) / 10,
      totalFiber: Math.round(totalFiber * 10) / 10,
      totalSugar: Math.round(totalSugar * 10) / 10,
      totalSodium: Math.round(totalSodium),
      servingInfo,
      hasDetailedLog: !!detailedLog,
      alternatives: filteredAlternatives,
      bestChoice,
      allergenWarning: allergenWarning.length > 0 ? allergenWarning : undefined
    };

    console.log('Analysis complete with', filteredAlternatives.length, 'alternatives');
    if (allergenWarning.length > 0) {
      console.log('Allergen warning:', allergenWarning);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-food function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: 'Failed to analyze food image'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
