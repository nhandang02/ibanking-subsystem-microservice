# iBanking Tuition Payment System

A microservices-based backend system for tuition payment via iBanking application, built with NestJS and Docker.

## Features

- **Microservices Architecture**: 7 independent services with API Gateway pattern
- **Authentication & Authorization**: JWT-based authentication with refresh tokens
- **User Management**: User profile and balance management
- **Student Lookup**: Search students by student code and retrieve tuition information
- **Payment Processing**: Saga pattern for distributed transaction management
- **OTP Verification**: Redis-based OTP system with email notifications
- **Event-Driven Communication**: RabbitMQ for asynchronous service communication
- **Rate Limiting**: API Gateway rate limiting for security
- **Health Monitoring**: Comprehensive health checks for all services

## Tech Stack

- **Framework**: NestJS (Microservices)
- **Databases**: PostgreSQL with TypeORM (Database per Service)
- **Message Queue**: RabbitMQ for event-driven communication
- **Caching**: Redis for OTP storage and session management
- **Authentication**: JWT with Passport (Access & Refresh tokens)
- **Email**: Nodemailer with SMTP
- **Containerization**: Docker & Docker Compose
- **API Gateway**: Request routing, authentication, rate limiting
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI

## Prerequisites

- Docker & Docker Compose
- Node.js (v18 or higher) - for development
- pnpm (recommended) or npm

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ibanking-subsystem
```

2. Set up environment variables for each service:

```bash
# Copy environment examples for all services
cp services/api-gateway/env.example services/api-gateway/.env
cp services/auth-service/env.example services/auth-service/.env
cp services/notification-service/env.example services/notification-service/.env
cp services/otp-service/env.example services/otp-service/.env
cp services/payment-service/env.example services/payment-service/.env
cp services/tuition-service/env.example services/tuition-service/.env
cp services/users-service/env.example services/users-service/.env
```

3. Configure each service's `.env` file:

**API Gateway** (`services/api-gateway/.env`):
```env
NODE_ENV=development
PORT=4000
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-super-secret-jwt-refresh-key
JWT_REFRESH_EXPIRES_IN=7d
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Auth Service** (`services/auth-service/.env`):
```env
NODE_ENV=development
PORT=4001
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-super-secret-jwt-refresh-key
JWT_REFRESH_EXPIRES_IN=7d
DB_HOST=auth_postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=authdb
```

**Notification Service** (`services/notification-service/.env`):
```env
NODE_ENV=production
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
```

**OTP Service** (`services/otp-service/.env`):
```env
NODE_ENV=development
PORT=4004
REDIS_HOST=redis
REDIS_PORT=6379
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
```

**Payment Service** (`services/payment-service/.env`):
```env
NODE_ENV=development
PORT=4007
DB_HOST=payment_postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=payment_db
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
REDIS_HOST=redis
REDIS_PORT=6379
```

**Tuition Service** (`services/tuition-service/.env`):
```env
NODE_ENV=development
PORT=4006
DB_HOST=tuition_postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=tuition_db
```

**Users Service** (`services/users-service/.env`):
```env
NODE_ENV=development
PORT=4005
DB_HOST=users_postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=usersdb
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
```

**⚠️ Important Notes:**
- Set `NODE_ENV=production` in notification service to enable real email sending
- Replace `your-email@gmail.com` and `your-app-password` with your actual Gmail credentials
- Replace `your-super-secret-jwt-key` with a strong secret key
- All database hosts use Docker service names (e.g., `auth_postgres`, `payment_postgres`)

4. Start the entire system with Docker Compose:
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

5. (Optional) Update tuition data using SQL script:
```bash
# Run tuition update script
docker exec -i tuition_postgres psql -U postgres -d tuition_db < scripts/insert_tuition.sql

# Or manually connect to database
docker exec -it tuition_postgres psql -U postgres -d tuition_db
```

## API Documentation

Once the application is running, visit:
- **Swagger UI**: http://localhost:4000/api
- **API Base URL**: http://localhost:4000
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)

## Architecture Overview

### Microservices Structure

| Service | Port | Description | Database |
|---------|------|-------------|----------|
| **API Gateway** | 4000 | Entry point, routing, authentication | - |
| **Auth Service** | 4001 | Authentication & JWT management | PostgreSQL (5433) |
| **Notification Service** | 4003 | Email notifications | - |
| **OTP Service** | 4004 | OTP generation & validation | Redis |
| **Users Service** | 4005 | User profiles & balance management | PostgreSQL (5437) |
| **Tuition Service** | 4006 | Student & tuition data | PostgreSQL (5435) |
| **Payment Service** | 4007 | Payment orchestration & saga | PostgreSQL (5436) |

### Infrastructure Services

| Service | Port | Description |
|---------|------|-------------|
| **Redis** | 6379 | OTP storage & caching |
| **RabbitMQ** | 5672 | Message queue |
| **RabbitMQ Management** | 15672 | Queue monitoring UI |

### Communication Patterns

- **Synchronous**: HTTP/REST via API Gateway
- **Asynchronous**: RabbitMQ for event-driven communication
- **Caching**: Redis for OTP and session data
- **Saga Pattern**: Payment Service orchestrates distributed transactions

## API Endpoints & Message Events

### Public API Endpoints (HTTP)
All endpoints are accessed through the API Gateway at `http://localhost:4000`

#### Health Check
- `GET /health` - Check health status of all services

#### Authentication
- `POST /auth/signin` - User sign in
- `POST /auth/signup` - User registration  
- `GET /auth/refresh` - Refresh access token (uses refresh token from cookies)
- `POST /auth/logout` - User logout (clears refresh token)
- `GET /auth/logout-all` - Logout from all devices (requires JWT)
- `GET /auth/me` - Get current user profile (requires JWT)

#### Tuition Management
- `GET /tuition/:studentId` - Lookup student by student ID (requires JWT)
- `GET /tuition` - Get all students (requires JWT)

#### Payment Processing (Saga Pattern)
- `POST /payments` - Start payment processing saga (requires JWT)
- `GET /payments/history` - Get user payment history (requires JWT)
- `GET /payments/:paymentId` - Get payment details by ID (requires JWT)
- `GET /payments/:paymentId/saga` - Get saga details for payment cancellation reason (requires JWT)

#### OTP Management
- `POST /otp/verify` - Verify OTP code for payment (requires JWT)
- `POST /payments/resend-otp/:paymentId` - Resend OTP for payment (requires JWT)
- `GET /otp/info/:paymentId` - Get OTP information for payment (requires JWT)

### Message Events (RabbitMQ)
Internal communication between services via RabbitMQ events

#### Payment Events
- `payment.created` - Payment saga started
- `payment.completed` - Payment transaction completed successfully
- `payment.failed` - Payment transaction failed
- `payment.cancelled` - Payment cancelled (timeout, max attempts, etc.)

#### OTP Events
- `otp.generated` - OTP code generated and stored in Redis
- `otp.verified` - OTP code verified successfully
- `otp.expired` - OTP code expired
- `otp.max_attempts` - Maximum OTP attempts exceeded

#### User Events
- `user.balance.updated` - User balance updated after transaction
- `user.balance.insufficient` - Insufficient balance for transaction

#### Saga Events
- `saga.step.completed` - Saga step completed successfully
- `saga.step.failed` - Saga step failed
- `saga.compensate` - Saga compensation triggered
- `saga.completed` - Entire saga completed successfully
- `saga.failed` - Entire saga failed

### API Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "message": "Error description",
  "errorCode": "ERROR_CODE",
  "errorType": "ErrorType",
  "details": "Additional error details",
  "timestamp": "2025-10-27T14:30:00.000Z",
  "service": "service-name"
}
```

## Sample Data

The application includes sample data seeded automatically:

### Users (Auth Service)
- **username**: `nhandang02`, **password**: `123456`, **email**: `thanhnhandang.it@gmail.com`
- **username**: `admin`, **password**: `admin123`, **email**: `admin@example.com`

### Users (Users Service) 
- **username**: `nhandang02`, **fullName**: `Dang Thanh Nhan`, **balance**: 1,998,500,000 VND
- **username**: `admin`, **fullName**: `Admin User`, **balance**: 20,000,000 VND

### Students (Tuition Service)
- **522H0006** - Dang Thanh Nhan (1,500,000 VND)
- **522H0051** - Nguyen Thanh Nhan (2,000,000 VND)

## Payment Flow (Saga Pattern)

### HTTP API Calls (Client → API Gateway)
1. **Sign In** - `POST /auth/signin`
2. **Lookup Student** - `GET /tuition/:studentId`
3. **Start Payment Saga** - `POST /payments`
4. **Verify OTP** - `POST /otp/verify`
5. **View Payment History** - `GET /payments/history`
6. **View Saga Details** - `GET /payments/:paymentId/saga`

### Message Events (Service-to-Service via RabbitMQ)
1. **Payment Created** - `payment.created` event published
2. **OTP Generation** - `otp.generated` event triggers email sending
3. **Email Notification** - Notification Service sends OTP email
4. **OTP Verified** - `otp.verified` event triggers saga execution
5. **Balance Update** - `user.balance.updated` event updates user balance
6. **Payment Completed** - `payment.completed` event triggers confirmation email
7. **Saga Events** - `saga.step.completed`, `saga.completed` events track progress

### Detailed Flow
1. **Client** calls `POST /payments` → **API Gateway** → **Payment Service**
2. **Payment Service** publishes `payment.created` event
3. **OTP Service** receives event, generates OTP, publishes `otp.generated`
4. **Notification Service** receives event, sends OTP email
5. **Client** calls `POST /otp/verify` → **API Gateway** → **OTP Service**
6. **OTP Service** publishes `otp.verified` event
7. **Payment Service** receives event, executes saga steps
8. **Users Service** receives `user.balance.updated` event, updates balance
9. **Payment Service** publishes `payment.completed` event
10. **Notification Service** receives event, sends confirmation email

## Security Features

- **JWT Authentication**: Access and refresh token system
- **Password Security**: bcrypt hashing with salt rounds
- **Rate Limiting**: API Gateway rate limiting per IP/user
- **Input Validation**: class-validator for request validation
- **SQL Injection Protection**: TypeORM parameterized queries
- **OTP Security**: Redis-based with expiry and attempt limits
- **CORS Protection**: Configurable allowed origins
- **Service Isolation**: Each service has its own database
- **Event Security**: RabbitMQ authentication and authorization
- **Health Monitoring**: Comprehensive service health checks

## Error Handling

- **Global Exception Filters**: Consistent error responses across all services
- **Custom Error Messages**: Business logic validation with clear messages
- **HTTP Status Codes**: Proper status codes for different error types
- **Request/Response Logging**: Comprehensive logging for debugging
- **Saga Compensation**: Automatic rollback for failed distributed transactions
- **Circuit Breaker Pattern**: Service failure isolation and recovery
- **Retry Mechanisms**: Automatic retry for transient failures
- **Health Checks**: Service availability monitoring

## Development

### Local Development Setup
```bash
# Start infrastructure services only
docker-compose up -d auth-postgres users-postgres tuition-postgres payment-postgres redis rabbitmq

# Install dependencies for specific service
cd services/auth-service
npm install

# Run service in development mode
npm run start:dev
```
### Monitoring and Debugging
```bash
# View service logs
docker-compose logs -f

# Check service health
curl http://localhost:4000/health

# Access RabbitMQ management
open http://localhost:15672
```