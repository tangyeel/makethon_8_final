🚀 Overview

  -This platform enables businesses, policymakers, and analysts to:

  -Automatically classify products using AI

  -Calculate international tariff costs

  -Apply trade agreement discounts

  -Compute geopolitical & supply chain risk scores

  -Visualize global trade routes on an interactive globe

  -Built for high-impact decision intelligence in global trade.


1. AI Product Classification
   -Returns HS Code
   - Confidence Score
   - Material Breakdown
   - Explanantion Logic

2. Dynamic Tariff Engine
   - Applies
     -Base Duty
     -Additional duties
     Trade Agreement discount

3. Risk Scoring Engine

Evaluates:

  -Country geopolitical risk
  -Trade exposure
  -Tariff burden
  -Material origin dependencies
  -Returns a numerical risk score.

4. Recalculate Engine
  -Allows real-time:
  -Destination changes
  -Value adjustments
  -Tariff recomputation
  -Risk recalculation

Local Setup
  Backend:
    cd backend
    pip install -r requirements.txt
  Add environment variables
    setx GROQ_API_KEY "paste_your_key"

  Frontend:
    cd frontend
    npm install
    npm run dev
    


Demo Flow (For Judges)

  -Upload product image

  -AI auto-classifies

  -Tariff + risk calculated

  -Globe visualizes trade flow

  -Change destination → instant recalculation
  
