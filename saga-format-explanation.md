#!/bin/bash

echo "📋 Saga Format Explanation"
echo "========================"

echo ""
echo "🔍 Current Saga Format Issues:"
echo "• Saga status: 'completed' but Payment status: 'cancelled'"
echo "• errorMessage: null (no cancellation reason)"
echo "• Only 1 step: create_payment (missing other steps)"
echo ""

echo "✅ Improved Saga Format (should be):"
echo "-----------------------------------"
echo '{
  "success": true,
  "data": {
    "id": "saga_paymentId_timestamp",
    "paymentId": "34070118-ea8d-4e6a-b064-63792ed8a6fa",
    "payerId": "fdd67749-2a3b-41e0-b289-df44ae9f71ca",
    "studentId": "522H0006",
    "amount": "1500000.00",
    "userEmail": "thanhnhandang.it@gmail.com",
    "status": "failed",  // 🔑 Should be "failed" for cancelled payments
    "currentStepIndex": 2,
    "steps": [
      {
        "id": "create_payment",
        "action": "createPayment",
        "compensation": "cancelPayment",
        "status": "completed",
        "retryCount": 0,
        "maxRetries": 3,
        "completedAt": "2025-10-27T14:03:31.000Z"
      },
      {
        "id": "send_otp",
        "action": "sendOtp",
        "compensation": "clearOtp",
        "status": "completed",
        "retryCount": 0,
        "maxRetries": 3,
        "completedAt": "2025-10-27T14:03:32.000Z"
      },
      {
        "id": "verify_otp",
        "action": "verifyOtp",
        "compensation": "cancelPayment",
        "status": "failed",  // 🔑 This step failed
        "retryCount": 3,
        "maxRetries": 3,
        "error": "OTP verification failed - max attempts exceeded"
      },
      {
        "id": "execute_transaction",
        "action": "executeTransaction",
        "compensation": "rollbackTransaction",
        "status": "pending",  // 🔑 Never executed due to previous failure
        "retryCount": 0,
        "maxRetries": 3
      }
    ],
    "completedSteps": [
      {
        "id": "create_payment",
        "action": "createPayment",
        "compensation": "cancelPayment",
        "status": "completed",
        "result": { "paymentCreated": true },
        "completedAt": "2025-10-27T14:03:31.000Z"
      },
      {
        "id": "send_otp",
        "action": "sendOtp",
        "compensation": "clearOtp",
        "status": "completed",
        "result": { "otpSent": true },
        "completedAt": "2025-10-27T14:03:32.000Z"
      }
    ],
    "errorMessage": "OTP verification failed - max attempts exceeded",  // 🔑 Clear reason
    "createdAt": "2025-10-27T14:03:30.661Z",
    "updatedAt": "2025-10-27T14:04:21.681Z"
  }
}'

echo ""
echo "🎯 How to Read Cancellation Reasons:"
echo "-----------------------------------"
echo "1. Check saga.status:"
echo "   • 'failed' = Payment was cancelled"
echo "   • 'completed' = Payment succeeded"
echo "   • 'pending' = Payment in progress"
echo ""
echo "2. Check errorMessage:"
echo "   • Main reason for cancellation"
echo "   • Examples: 'Payment timeout', 'OTP failed', 'Insufficient balance'"
echo ""
echo "3. Check steps[].status:"
echo "   • See which step failed"
echo "   • Check steps[].error for detailed error"
echo ""
echo "4. Check completedSteps:"
echo "   • See which steps succeeded before failure"
echo ""

echo "🔧 Fixed Issues:"
echo "• Saga status now updates to 'failed' when payment cancelled"
echo "• errorMessage shows clear cancellation reason"
echo "• All steps are tracked properly"
