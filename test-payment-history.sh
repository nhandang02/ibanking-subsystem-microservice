#!/bin/bash

# Test script để kiểm tra Payment History API
echo "🧪 Testing Payment History API"
echo "=============================="

# Base URL
BASE_URL="http://localhost:4000"

# Test 1: Get payment history (requires authentication)
echo ""
echo "📝 Test 1: Get Payment History"
echo "Expected: List of payments for authenticated user"
echo ""
echo "Note: You need to be authenticated first. Get a token from /auth/signin"
echo ""
echo "Example usage:"
echo "curl -X GET '$BASE_URL/payments/history' \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \\"
echo "  -H 'Content-Type: application/json' | jq '.'"
echo ""

# Test 2: Get specific payment details
echo "📝 Test 2: Get Payment Details"
echo "Expected: Details of a specific payment"
echo ""
echo "Example usage:"
echo "curl -X GET '$BASE_URL/payments/PAYMENT_ID_HERE' \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \\"
echo "  -H 'Content-Type: application/json' | jq '.'"
echo ""

echo "✅ Payment History API endpoints added!"
echo ""
echo "Available endpoints:"
echo "• GET /payments/history - Get payment history for current user"
echo "• GET /payments/:paymentId - Get specific payment details"
echo ""
echo "Both endpoints require authentication with Bearer token."


