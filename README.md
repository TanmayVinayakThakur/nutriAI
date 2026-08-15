# Smart Food Finder (NutriScanXAI)

A web interface that scans a food item, correctly identifies it from a photo, and suggests healthier alternatives using Explainable AI tools. The system ensures transparency by providing the exact reasoning behind its recommendations.

## Core Features

- **Photo-based food analysis**: Upload or drag-and-drop a food photo to get an instant nutrition read.
- **Two scanning modes**:
  - *Quick Scan*: For packaged or ready-to-eat foods.
  - *Detailed Logging*: For homemade meals where you enter ingredients and amounts for more accurate totals.
- **Healthier alternatives**: Get suggestions for better food choices similar to what you scanned.
- **Explainable recommendations**: See exactly why an alternative is better, with side-by-side nutrition comparisons and clear evidence points.
- **“Best choice” highlight**: One top recommendation is singled out for you.
- **Smart “already optimal” detection**: If your scanned food is already the healthiest option, the app tells you instead of forcing alternatives.
- **Allergy awareness**: Warnings if your scanned food contains something you’re allergic to, and allergens are filtered out of suggestions.
- **Diet preference support**: Filters suggestions based on vegan, vegetarian, or non-vegetarian preferences.
- **Body-goal personalization**: Recommendations adapt to whether your goal is to gain muscle, lose fat, or maintain weight.
- **User profile & onboarding**: Captures height, weight, age, diet type, allergies, current body type, and target body type; also shows BMI category.
- **Indian-food focus**: Alternatives prioritize Indian dishes and ingredients.

## Reliability & Experience

- **Image optimization**: Photos are resized and compressed before analysis so uploads stay fast and reliable.
- **Retry & fallback logic**: If analysis hits a temporary issue, the app retries automatically and can fall back to a rule-based score.
- **Responsive, modern UI**: Clean cards, progress animations, and mobile-friendly layout.

## Dataset for Model Training

The model is trained on food data pulled from Open Food Facts, specifically focused on Indian food items. It is fetched live rather than stored in a fixed database, ensuring that the recommendations stay current.

## How Linear Regression Helps Explainability

The scoring model utilizes a simple linear regression approach. It assigns a weight to each nutrition factor: for example, calories, sugar, and saturated fat get negative weights because lower is better, while protein and fiber get positive weights because higher is better. The final health score is just the weighted sum of these factors.

Because the model is linear, the explanation is completely transparent. We can point to each weight and show the user exactly which nutrients pulled a food’s score up or down. That makes the “why this is healthier” comparison easy to understand without hiding the reasoning inside a complex black-box model.

## Development

To work on this project locally, you need Node.js and npm installed. We recommend installing Node via [nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
