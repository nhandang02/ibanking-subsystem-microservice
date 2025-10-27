# 🎯 Interaction Flow Diagram Prompt - iBanking Tuition Payment System

## Mục tiêu
Mô tả luồng xử lý thanh toán học phí từ đầu đến cuối (end-to-end) trong hệ thống iBanking microservices với Saga pattern.

## 📋 Các bước trong luồng thanh toán

### 1. 🔐 Authentication & Authorization
- **Student** → **API Gateway** → **Auth Service** → JWT issued
- API Gateway validates JWT token cho các request tiếp theo

### 2. 🎓 Student Lookup & Tuition Retrieval
- **Student** → **API Gateway** → **Tuition Service** → Student details & tuition amount returned
- Validate student exists and is active

### 3. 💳 Payment Initiation (Saga Pattern)
- **Student** → **API Gateway** → **Payment Service** → Payment Saga created
- **Payment Service** → **Users Service** → Validate payer balance
- Payment record created with status "pending"

### 4. 📧 OTP Generation & Email Notification
- **Payment Service** → **OTP Service** → Generate 6-digit OTP (2-minute expiry)
- **OTP Service** → **Notification Service** → Send OTP email via SMTP
- OTP stored in Redis with transaction ID

### 5. ✅ OTP Verification
- **Student** → **API Gateway** → **Payment Service** → **OTP Service** → Verify OTP
- OTP Service validates code, tracks attempts (max 5), handles expiry
- If valid: proceed to transaction execution
- If invalid: increment attempts, cancel payment if max attempts reached

### 6. 💰 Transaction Execution
- **Payment Service** → **Users Service** → Deduct balance from payer account
- **Payment Service** → Update payment status to "completed"
- Create transaction audit record

### 7. 📬 Post-Processing & Notifications
- **Payment Service** → **Notification Service** → Send payment confirmation email
- **Payment Service** → Publish "PaymentCompleted" event via RabbitMQ
- Update payment status and create audit logs

### 8. 🚫 Error Handling & Compensation
- If any step fails: Saga compensation pattern triggers
- Rollback completed steps (cancel payment, restore balance)
- Send failure notification email
- Log error details for audit

## 🎨 Hướng dẫn vẽ trong Canva

### Layout Options
- **Sequence Diagram** (dọc từ trên xuống) - Recommended
- **Flowchart** (ngang từ trái sang phải)

### Màu sắc
- 🔵 **Xanh dương**: User actions (Student interactions)
- 🟢 **Xanh lá**: System processes (Internal services)
- 🟡 **Vàng**: External APIs (SMTP, Database)
- 🔴 **Đỏ**: Error handling & compensation
- 🟣 **Tím**: Event publishing (RabbitMQ)

### Icons cho từng bước
- 🔐 Authentication
- 🎓 Student lookup
- 💳 Payment creation
- 📧 OTP generation
- ✅ OTP verification
- 💰 Transaction execution
- 📬 Notifications
- 🚫 Error handling

## 🏗️ Đặc điểm kỹ thuật cần highlight

### Architecture Patterns
- **Saga Pattern**: Orchestration với compensation
- **Microservices**: 7 services độc lập
- **Event-Driven**: RabbitMQ cho async communication
- **API Gateway**: Single entry point

### Services Architecture
1. **API Gateway** (Port 4000) - Entry point, routing, authentication
2. **Auth Service** (Port 4001) - JWT authentication, user management
3. **Users Service** (Port 4005) - User profiles, balance management
4. **Tuition Service** (Port 4006) - Student data, tuition amounts
5. **Payment Service** (Port 4007) - Payment orchestration, saga management
6. **OTP Service** (Port 4004) - OTP generation, validation
7. **Notification Service** (Port 4003) - Email notifications

### Technology Stack
- **Caching**: Redis cho OTP storage
- **Database**: PostgreSQL cho mỗi service
- **Message Queue**: RabbitMQ cho event communication
- **Security**: JWT authentication, OTP validation
- **Email**: SMTP via Nodemailer

## 🚨 Error Scenarios

### OTP Related Errors
- **OTP Expired**: 2 minutes timeout
- **Max OTP Attempts**: 5 attempts limit
- **Invalid OTP**: Wrong code entered

### Payment Related Errors
- **Insufficient Balance**: Payer doesn't have enough funds
- **Student Not Found**: Invalid student ID
- **Payment Already Processed**: Duplicate payment attempt

### System Errors
- **Service Unavailable**: Microservice down
- **Network Timeout**: Communication failure
- **Database Error**: Data persistence issues

## 📊 Sample Flow Structure

```
Student → API Gateway → Auth Service → JWT Token
Student → API Gateway → Tuition Service → Student Info
Student → API Gateway → Payment Service → Saga Created
Payment Service → OTP Service → OTP Generated
OTP Service → Notification Service → Email Sent
Student → API Gateway → Payment Service → OTP Verified
Payment Service → Users Service → Balance Deducted
Payment Service → Notification Service → Confirmation Sent
```

## 🔄 Saga Pattern Details

### Saga Steps
1. **create_payment**: Create payment record
2. **generate_otp**: Generate and send OTP
3. **verify_otp**: Validate OTP code
4. **execute_transaction**: Process payment
5. **send_confirmation**: Send success notification

### Compensation Actions
- **cancel_payment**: Rollback payment creation
- **clear_otp**: Remove OTP from Redis
- **restore_balance**: Undo balance deduction
- **send_failure_notification**: Notify user of failure

## 📝 API Endpoints Flow

### Authentication
- `POST /auth/signin` - User login
- `GET /auth/me` - Get user profile
- `POST /auth/refresh` - Refresh JWT token

### Student Management
- `GET /tuition/:studentId` - Get student tuition info
- `GET /tuition` - Get all students

### Payment Processing
- `POST /payments` - Create payment saga
- `POST /otp/verify` - Verify OTP
- `POST /payments/resend-otp/:paymentId` - Resend OTP
- `GET /otp/info/:paymentId` - Get OTP information

## 🎯 Key Success Factors

### Security
- JWT-based authentication
- OTP validation with attempt limits
- Balance verification before transaction
- Audit logging for all operations

### Reliability
- Saga pattern for transaction consistency
- Retry mechanisms for failed operations
- Compensation for rollback scenarios
- Health checks for all services

### User Experience
- Real-time OTP delivery via email
- Clear error messages
- Payment status tracking
- Confirmation notifications

---

**Lưu ý**: Sử dụng prompt này để tạo interaction flow diagram trong Canva hoặc bất kỳ công cụ vẽ diagram nào khác. Đảm bảo highlight các điểm quan trọng về kiến trúc microservices, saga pattern, và error handling.

