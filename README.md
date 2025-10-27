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

2. Set up environment variables:
```bash
cp env.example .env
```

3. Configure your `.env` file:
```env
# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-super-secret-jwt-refresh-key
JWT_REFRESH_EXPIRES_IN=7d

# Email (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Redis
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_USER=guest
RABBITMQ_PASS=guest
RABBITMQ_PORT=5672
RABBITMQ_MGMT_PORT=15672

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Environment
NODE_ENV=development
```

4. Start the entire system with Docker Compose:
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

5. Alternative: Start services individually using scripts:
```bash
# Start infrastructure first (databases, Redis, RabbitMQ)
./scripts/start-infrastructure.sh

# Then start services one by one or use the interactive menu
./scripts/start-service.sh
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

## API Endpoints

All endpoints are accessed through the API Gateway at `http://localhost:4000`

### Authentication
- `POST /auth/signin` - User sign in
- `POST /auth/signup` - User registration
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - User logout
- `GET /auth/profile` - Get user profile (requires JWT)

### Users
- `GET /users/profile` - Get user profile (requires JWT)
- `PUT /users/profile` - Update user profile (requires JWT)
- `GET /users/balance` - Get user balance (requires JWT)

### Students
- `POST /students/lookup` - Lookup student by code (requires JWT)

### Payments
- `POST /payments` - Create payment preparation (requires JWT)
- `GET /payments/:id` - Get payment details (requires JWT)
- `GET /payments` - Get user payment history (requires JWT)

### OTP
- `POST /otp/generate` - Generate OTP for payment (requires JWT)
- `POST /otp/verify` - Verify OTP code (requires JWT)
- `POST /otp/resend` - Resend OTP (requires JWT)

### Transactions
- `POST /transactions/execute` - Execute transaction after OTP verification (requires JWT)
- `GET /transactions/history` - Get transaction history (requires JWT)

### Health Check
- `GET /health` - Check health status of all services

## Sample Data

The application includes sample data seeded automatically:

### Users
- **username**: `user1`, **password**: `password123`, **balance**: 10,000,000 VND
- **username**: `user2`, **password**: `password123`, **balance**: 5,000,000 VND
- **username**: `admin`, **password**: `admin123`, **balance**: 20,000,000 VND

### Students
- **20110001** - Lê Văn C (5,000,000 VND)
- **20110002** - Phạm Thị D (4,500,000 VND)
- **20110003** - Hoàng Văn E (6,000,000 VND)
- **20110004** - Trần Thị F (3,500,000 VND)
- **20110005** - Nguyễn Văn G (7,000,000 VND)

## Payment Flow

1. **Sign In** with username/password via Auth Service
2. **Lookup Student** by student code via Tuition Service
3. **Create Payment** preparation via Payment Service (validates balance via Users Service)
4. **Generate OTP** via OTP Service (stored in Redis)
5. **Send OTP Email** via Notification Service (triggered by RabbitMQ event)
6. **Verify OTP** code via OTP Service
7. **Execute Transaction** via Payment Service using Saga pattern:
   - Deduct balance from Users Service
   - Create transaction record in Payment Service
   - Send confirmation email via Notification Service
8. **Receive Confirmation** email with transaction details

## Database Schema

### Auth Service Database (authdb)
- **Users Table**: Authentication data, JWT tokens
- **Refresh Tokens Table**: Refresh token management

### Users Service Database (usersdb)
- **Users Table**: User profiles, balances, account information
- **Transactions Table**: Transaction history and records

### Tuition Service Database (tuition_db)
- **Students Table**: Student information and tuition amounts
- **Tuition Records Table**: Tuition payment history

### Payment Service Database (payment_db)
- **Payments Table**: Payment preparations and status
- **Saga Table**: Distributed transaction state management
- **Transactions Table**: Payment transaction records

### Redis Cache
- **OTP Storage**: Temporary OTP codes with expiry
- **Session Cache**: User session data
- **Rate Limiting**: API Gateway rate limiting data

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

## Testing

### Individual Service Testing
```bash
# Navigate to specific service directory
cd services/auth-service

# Install dependencies
npm install

# Run tests
npm test
npm run test:e2e
npm run test:cov
```

### Full System Testing
```bash
# Start all services
docker-compose up -d

# Run integration tests
npm test:e2e

# Check service health
curl http://localhost:4000/health
```

### Manual Testing
1. Start the system: `docker-compose up -d`
2. Access Swagger UI: http://localhost:4000/api
3. Test authentication flow
4. Test payment flow with sample data
5. Monitor logs: `docker-compose logs -f`

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

### Service Management Scripts
```bash
# Interactive service manager
./scripts/start-service.sh

# Start individual services
./scripts/start-auth-service.sh
./scripts/start-users-service.sh
./scripts/start-tuition-service.sh
./scripts/start-payment-service.sh
./scripts/start-api-gateway.sh

# Cleanup and reset
./scripts/cleanup.sh
```

### Monitoring and Debugging
```bash
# View service logs
docker-compose logs -f auth-service
docker-compose logs -f payment-service

# Check service health
curl http://localhost:4000/health

# Access RabbitMQ management
open http://localhost:15672

# Connect to databases
psql -h localhost -p 5433 -U postgres -d authdb
psql -h localhost -p 5437 -U postgres -d usersdb
```

## Deployment

### Production Deployment
```bash
# Build all services
docker-compose build

# Start in production mode
docker-compose up -d

# Scale specific services
docker-compose up -d --scale auth-service=2 --scale users-service=2
```

### Environment Configuration
```bash
# Production environment variables
NODE_ENV=production
JWT_SECRET=your-production-jwt-secret
JWT_REFRESH_SECRET=your-production-refresh-secret
SMTP_HOST=your-smtp-host
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
ALLOWED_ORIGINS=https://yourdomain.com
```

### Health Monitoring
```bash
# Check all services health
curl http://localhost:4000/health

# Monitor service logs
docker-compose logs -f --tail=100

# Check resource usage
docker stats
```

### Backup and Recovery
```bash
# Backup databases
docker exec auth_postgres pg_dump -U postgres authdb > auth_backup.sql
docker exec users_postgres pg_dump -U postgres usersdb > users_backup.sql

# Restore databases
docker exec -i auth_postgres psql -U postgres authdb < auth_backup.sql
```

## Troubleshooting

### Common Issues

#### Services not starting
```bash
# Check service logs
docker-compose logs service-name

# Check port conflicts
lsof -i :4000

# Restart specific service
docker-compose restart service-name
```

#### Database connection issues
```bash
# Check database health
docker-compose ps

# Connect to database directly
docker exec -it auth_postgres psql -U postgres -d authdb
```

#### RabbitMQ issues
```bash
# Check RabbitMQ status
docker exec ibanking_rabbitmq rabbitmq-diagnostics status

# Reset RabbitMQ
docker-compose restart rabbitmq
```

## License

This project is licensed under the Nhan Dang License - see the LICENSE file for details.