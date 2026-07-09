#!/bin/bash
echo "=== Testing M13 Competitor Intelligence Radar API ==="

# Note: Replace <YOUR_JWT_TOKEN_HERE> with an active Fastify auth_token.
# For terminal testing, you can extract this from the browser cookies after logging in.
TOKEN="<YOUR_JWT_TOKEN_HERE>"
LOCATION_ID=26
ORG_ID=1

echo -e "\n1. Adding a new Radar Keyword..."
KEYWORD_RES=$(curl -s -X POST http://127.0.0.1:3000/api/v1/radar \
  -H "Cookie: auth_token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"keywordText\": \"Best Dentist Near Me\", \"locationId\": $LOCATION_ID, \"organizationId\": $ORG_ID}")
echo $KEYWORD_RES

# Extract the newly created keywordId from the JSON response using grep/awk or assume ID 1 for testing
KEYWORD_ID=$(echo $KEYWORD_RES | grep -o '"id":[0-9]*' | awk -F':' '{print $2}')

if [ -z "$KEYWORD_ID" ]; then
    echo "Failed to extract Keyword ID. Ensure your JWT token is valid."
    exit 1
fi

echo -e "\n2. Triggering On-Demand SERP Map-Pack Scan for Keyword $KEYWORD_ID..."
curl -s -X POST http://127.0.0.1:3000/api/v1/radar/track/$KEYWORD_ID \
  -H "Cookie: auth_token=$TOKEN" \
  | jq '.'

echo -e "\n3. Fetching Aggregated Keyword History Array..."
curl -s -X GET "http://127.0.0.1:3000/api/v1/radar?locationId=$LOCATION_ID" \
  -H "Cookie: auth_token=$TOKEN" \
  | jq '.'

echo -e "\n=== M13 Testing Complete ==="
