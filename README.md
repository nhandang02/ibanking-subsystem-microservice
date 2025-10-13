# iBanking Tuition Payment System

A NestJS-based backend system for tuition payment via iBanking application.

## Features

- **Authentication & Authorization**: JWT-based authentication with username/password login
- **Payer Management**: User profile management with locked editing
- **Student Lookup**: Search students by student code and retrieve tuition information
- **Payment Processing**: Create payment preparations with balance validation
- **OTP Verification**: Email-based OTP system with 5-minute expiry
- **Transaction Management**: Secure transaction execution with database transactions
- **Concurrency Control**: Pessimistic locking to prevent race conditions

## Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT with Passport
- **Email**: Nodemailer
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- pnpm (recommended) or npm

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ibanking-subsystem
```

2. Install dependencies:
```bash
pnpm install
# or
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
```

4. Configure your `.env` file:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your-password
DB_DATABASE=ibanking

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h

# Email (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# App
PORT=3000
NODE_ENV=development
```

5. Create PostgreSQL database:
```sql
CREATE DATABASE ibanking;
```

6. Run the application:
```bash
# Development
pnpm start:dev

# Production
pnpm build
pnpm start:prod
```

## API Documentation

Once the application is running, visit:
- **Swagger UI**: http://localhost:3000/api
- **API Base URL**: http://localhost:3000

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `GET /auth/profile` - Get user profile (requires JWT)

### Payer
- `GET /payer/profile` - Get payer profile (read-only, requires JWT)

### Student
- `POST /student/lookup` - Lookup student by code (requires JWT)

### Payment
- `POST /payment` - Create payment preparation (requires JWT)
- `GET /payment/:id` - Get payment details (requires JWT)

### OTP
- `POST /otp/send` - Send OTP for payment confirmation (requires JWT)
- `POST /otp/verify` - Verify OTP code (requires JWT)

### Transaction
- `POST /transaction/execute` - Execute transaction after OTP verification (requires JWT)
- `GET /transaction/history` - Get transaction history (requires JWT)

## Sample Data

The application includes sample data:
- **Users**: 
  - username: `user1`, password: `password123`
  - username: `user2`, password: `password123`
- **Students**: 
  - `20110001` - Lê Văn C (5,000,000 VND)
  - `20110002` - Phạm Thị D (4,500,000 VND)
  - `20110003` - Hoàng Văn E (6,000,000 VND)

## Payment Flow

1. **Login** with username/password
2. **Lookup student** by student code to get tuition amount
3. **Create payment** preparation (validates balance)
4. **Send OTP** via email for confirmation
5. **Verify OTP** code
6. **Execute transaction** (deducts balance, creates transaction record)
7. **Receive confirmation** email

## Database Schema

### Users Table
- `id` (UUID, Primary Key)
- `username` (Unique)
- `passwordHash`
- `fullName`
- `email` (Unique)
- `phoneNumber` (Unique)
- `availableBalance` (Decimal)

### Students Table
- `studentCode` (Primary Key)
- `studentName`
- `amount` (Decimal)
- `isActive` (Boolean)

### Payments Table
- `id` (UUID, Primary Key)
- `payerBalance` (Decimal)
- `tuitionAmount` (Decimal)
- `paymentTerms` (Text)
- `status` (String)
- `payerId` (Foreign Key)
- `studentCode` (Foreign Key)

### OTPs Table
- `id` (UUID, Primary Key)
- `code` (Unique)
- `paymentId` (Foreign Key)
- `expiresAt` (Timestamp)
- `isUsed` (Boolean)

### Transactions Table
- `id` (UUID, Primary Key)
- `amount` (Decimal)
- `status` (String)
- `description` (Text)
- `payerId` (Foreign Key)
- `studentCode` (Foreign Key)

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Input validation with class-validator
- SQL injection protection with TypeORM
- Pessimistic locking for concurrency control
- OTP expiry and single-use validation

## Error Handling

- Global exception filter for consistent error responses
- Custom error messages for business logic validation
- Proper HTTP status codes
- Request/response logging

## Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Test coverage
pnpm test:cov
```

## Development

```bash
# Start in development mode
pnpm start:dev

# Build the application
pnpm build

# Lint code
pnpm lint

# Format code
pnpm format
```

## License

This project is licensed under the Nhan Dang License.