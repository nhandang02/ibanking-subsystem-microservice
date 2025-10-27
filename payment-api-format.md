#!/bin/bash

echo "📋 Payment History & Saga API Format Demo"
echo "========================================"

echo ""
echo "🔍 1. Payment History Format"
echo "GET /payments/history"
echo "-------------------"
echo '{
  "success": true,
  "data": {
    "success": true,
    "data": [
      {
        "id": "997fa721-63f0-4edc-b0c9-aa3b5a45a6dd",
        "payerBalance": "2000000000.00",
        "tuitionAmount": "1500000.00", 
        "paymentTerms": "Agree to pay full tuition amount",
        "payerId": "fdd67749-2a3b-41e0-b289-df44ae9f71ca",
        "studentId": "522H0006",
        "status": "completed",
        "createdAt": "2025-10-27T14:04:29.782Z",
        "updatedAt": "2025-10-27T14:04:55.820Z"
      },
      {
        "id": "34070118-ea8d-4e6a-b064-63792ed8a6fa",
        "payerBalance": "2000000000.00",
        "tuitionAmount": "1500000.00",
        "paymentTerms": "Agree to pay full tuition amount", 
        "payerId": "fdd67749-2a3b-41e0-b289-df44ae9f71ca",
        "studentId": "522H0006",
        "status": "cancelled",
        "createdAt": "2025-10-27T14:03:30.820Z",
        "updatedAt": "2025-10-27T14:04:21.681Z"
      }
    ]
  }
}'

echo ""
echo "🔍 2. Saga Details Format (for cancellation reason)"
echo "GET /payments/:paymentId/saga"
echo "----------------------------"
echo '{
  "success": true,
  "data": {
    "id": "saga_34070118-ea8d-4e6a-b064-63792ed8a6fa_1761573810644",
    "paymentId": "34070118-ea8d-4e6a-b064-63792ed8a6fa",
    "payerId": "fdd67749-2a3b-41e0-b289-df44ae9f71ca",
    "studentId": "522H0006",
    "amount": "1500000.00",
    "userEmail": "thanhnhandang.it@gmail.com",
    "status": "failed",
    "currentStepIndex": 2,
    "steps": [
      {
        "id": "validate_payment",
        "action": "validate_payment",
        "compensation": "cancel_payment",
        "status": "completed",
        "retryCount": 0,
        "maxRetries": 3,
        "completedAt": "2025-10-27T14:03:31.000Z"
      },
      {
        "id": "send_otp",
        "action": "send_otp", 
        "compensation": "clear_otp",
        "status": "completed",
        "retryCount": 0,
        "maxRetries": 3,
        "completedAt": "2025-10-27T14:03:32.000Z"
      },
      {
        "id": "verify_otp",
        "action": "verify_otp",
        "compensation": "cancel_payment",
        "status": "failed",
        "retryCount": 3,
        "maxRetries": 3,
        "error": "OTP verification failed - max attempts exceeded"
      }
    ],
    "completedSteps": [
      {
        "id": "validate_payment",
        "action": "validate_payment", 
        "compensation": "cancel_payment",
        "status": "completed",
        "result": { "valid": true },
        "completedAt": "2025-10-27T14:03:31.000Z"
      },
      {
        "id": "send_otp",
        "action": "send_otp",
        "compensation": "clear_otp", 
        "status": "completed",
        "result": { "otpSent": true },
        "completedAt": "2025-10-27T14:03:32.000Z"
      }
    ],
    "errorMessage": "OTP verification failed - max attempts exceeded",
    "createdAt": "2025-10-27T14:03:30.661Z",
    "updatedAt": "2025-10-27T14:04:21.681Z"
  }
}'

echo ""
echo "📝 3. Usage Examples"
echo "-------------------"
echo "# Get payment history"
echo "curl -X GET 'http://localhost:4000/payments/history' \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN'"
echo ""
echo "# Get cancellation reason for specific payment"
echo "curl -X GET 'http://localhost:4000/payments/34070118-ea8d-4e6a-b064-63792ed8a6fa/saga' \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN'"
echo ""
echo "🎯 Key Fields for Cancellation Reasons:"
echo "• errorMessage: Main reason for failure/cancellation"
echo "• steps[].error: Error details for each step"
echo "• status: 'failed' indicates cancellation"
echo "• completedSteps: Shows which steps succeeded"


