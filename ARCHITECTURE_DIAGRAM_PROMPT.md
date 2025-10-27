# 🏗️ Architecture Diagram Prompt - iBanking Microservices System

## Mục tiêu
Tạo sơ đồ kiến trúc tổng thể của hệ thống iBanking thanh toán học phí với kiến trúc microservices, hiển thị các service, database, message queue và luồng dữ liệu.

## 🎯 Kiến trúc tổng thể

### Core Architecture Pattern
- **Microservices Architecture** với 7 services độc lập
- **API Gateway Pattern** - Single entry point
- **Event-Driven Architecture** với RabbitMQ
- **Saga Pattern** cho distributed transactions
- **Database per Service** pattern

## 🏢 Services Architecture

### 1. API Gateway (Port 4000)
- **Vai trò**: Entry point, routing, authentication, rate limiting
- **Technology**: NestJS, Express
- **Responsibilities**: 
  - Request routing to microservices
  - JWT token validation
  - Rate limiting và security
  - Response aggregation

### 2. Auth Service (Port 4001)
- **Vai trò**: Authentication & Authorization
- **Database**: PostgreSQL (authdb)
- **Technology**: NestJS, JWT, Passport
- **Responsibilities**:
  - User login/logout
  - JWT token generation/validation
  - Refresh token management
  - User session management

### 3. Users Service (Port 4005)
- **Vai trò**: User profile & balance management
- **Database**: PostgreSQL (usersdb)
- **Technology**: NestJS, TypeORM
- **Responsibilities**:
  - User profile CRUD
  - Balance management
  - Account validation
  - Transaction history

### 4. Tuition Service (Port 4006)
- **Vai trò**: Student & tuition management
- **Database**: PostgreSQL (tuition_db)
- **Technology**: NestJS, TypeORM
- **Responsibilities**:
  - Student data management
  - Tuition amount calculation
  - Student lookup by ID
  - Tuition status tracking

### 5. Payment Service (Port 4007)
- **Vai trò**: Payment orchestration & saga management
- **Database**: PostgreSQL (payment_db)
- **Technology**: NestJS, TypeORM, RabbitMQ
- **Responsibilities**:
  - Payment saga orchestration
  - Transaction coordination
  - Payment status management
  - Compensation handling

### 6. OTP Service (Port 4004)
- **Vai trò**: OTP generation & validation
- **Storage**: Redis
- **Technology**: NestJS, Redis
- **Responsibilities**:
  - 6-digit OTP generation
  - OTP validation & attempt tracking
  - OTP expiry management
  - Security validation

### 7. Notification Service (Port 4003)
- **Vai trò**: Email & SMS notifications
- **Technology**: NestJS, Nodemailer, SMTP
- **Responsibilities**:
  - OTP email sending
  - Payment confirmation emails
  - Error notification emails
  - Email template management

## 🗄️ Data Layer

### Databases
- **Auth PostgreSQL** (Port 5433): User authentication data
- **Users PostgreSQL** (Port 5437): User profiles & balances
- **Tuition PostgreSQL** (Port 5435): Student & tuition data
- **Payment PostgreSQL** (Port 5436): Payment & transaction records

### Caching Layer
- **Redis** (Port 6379): OTP storage, session cache

### Message Queue
- **RabbitMQ** (Port 5672): Event-driven communication
- **Management UI** (Port 15672): Queue monitoring

## 🔄 Communication Patterns

### Synchronous Communication
- **HTTP/REST**: API Gateway ↔ Microservices
- **RPC**: Service-to-service calls via RabbitMQ

### Asynchronous Communication
- **Event Publishing**: Payment events, OTP events
- **Message Queues**: RabbitMQ for decoupled communication
- **Event Patterns**:
  - `otp.generated` → Notification Service
  - `payment.completed` → Notification Service
  - `payment.failed` → Notification Service

## 🎨 Hướng dẫn vẽ Architecture Diagram

### Layout Style
- **Layered Architecture**: 3 layers (Presentation, Business, Data)
- **Service-oriented**: Group services by domain
- **Top-down flow**: User → API Gateway → Services → Data

### Color Coding
- 🔵 **Blue**: API Gateway & External interfaces
- 🟢 **Green**: Business services (Auth, Users, Tuition, Payment)
- 🟡 **Yellow**: Utility services (OTP, Notification)
- 🟣 **Purple**: Data layer (Databases, Cache)
- 🔴 **Red**: Message queue & event bus
- ⚫ **Gray**: External systems (SMTP, Email)

### Shapes & Icons
- **Rectangle**: Services
- **Cylinder**: Databases
- **Cloud**: External systems
- **Diamond**: Message queues
- **Arrows**: Data flow direction

## 📊 Architecture Layers

### Presentation Layer
```
[Client/Frontend] → [API Gateway:4000]
```

### Business Logic Layer
```
[Auth Service:4001] ← JWT Validation
[Users Service:4005] ← User Management
[Tuition Service:4006] ← Student Data
[Payment Service:4007] ← Payment Orchestration
[OTP Service:4004] ← OTP Management
[Notification Service:4003] ← Email/SMS
```

### Data Layer
```
[Auth DB:5433] ← Authentication Data
[Users DB:5437] ← User Profiles
[Tuition DB:5435] ← Student Data
[Payment DB:5436] ← Transaction Data
[Redis:6379] ← OTP Cache
```

### Infrastructure Layer
```
[RabbitMQ:5672] ← Message Queue
[SMTP Server] ← Email Service
```

## 🔗 Service Dependencies

### API Gateway Dependencies
- Auth Service (authentication)
- All business services (routing)

### Payment Service Dependencies
- Users Service (balance validation)
- OTP Service (OTP generation)
- Notification Service (email notifications)
- RabbitMQ (event publishing)

### OTP Service Dependencies
- Redis (OTP storage)
- RabbitMQ (event publishing)

### Notification Service Dependencies
- SMTP Server (email sending)
- RabbitMQ (event consumption)

## 🚀 Deployment Architecture

### Container Orchestration
- **Docker Compose**: Local development
- **Docker Containers**: Each service containerized
- **Health Checks**: All services have health endpoints

### Port Mapping
- API Gateway: 4000
- Auth Service: 4001
- Notification Service: 4003 (internal only)
- OTP Service: 4004 (internal only)
- Users Service: 4005
- Tuition Service: 4006
- Payment Service: 4007

### Database Ports
- Auth DB: 5433
- Tuition DB: 5435
- Payment DB: 5436
- Users DB: 5437
- Redis: 6379
- RabbitMQ: 5672, 15672

## 🔒 Security Architecture

### Authentication Flow
```
Client → API Gateway → Auth Service → JWT Token
Client → API Gateway (with JWT) → Business Services
```

### Security Measures
- JWT-based authentication
- Rate limiting at API Gateway
- Service-to-service authentication
- Database connection encryption
- OTP expiry and attempt limits

## 📈 Scalability Considerations

### Horizontal Scaling
- Each service can scale independently
- Stateless services (except databases)
- Load balancer ready architecture

### Performance Optimization
- Redis caching for OTP
- Database connection pooling
- Async message processing
- Connection reuse

## 🔄 Data Flow Patterns

### Request Flow
```
Client → API Gateway → Service → Database
Client ← API Gateway ← Service ← Database
```

### Event Flow
```
Service A → RabbitMQ → Service B
Service A → RabbitMQ → Multiple Services
```

### Saga Flow
```
Payment Service → Orchestrate → Multiple Services
Payment Service ← Compensate ← Failed Steps
```

## 🎯 Key Architecture Benefits

### Microservices Benefits
- **Independent Deployment**: Each service can be deployed separately
- **Technology Diversity**: Each service can use different tech stacks
- **Fault Isolation**: Failure in one service doesn't affect others
- **Scalability**: Scale services based on demand

### Event-Driven Benefits
- **Loose Coupling**: Services communicate via events
- **Asynchronous Processing**: Non-blocking operations
- **Resilience**: Retry mechanisms and error handling
- **Auditability**: Event logging for debugging

### Saga Pattern Benefits
- **Distributed Transactions**: Handle complex business workflows
- **Compensation**: Rollback failed operations
- **Consistency**: Maintain data consistency across services
- **Reliability**: Handle partial failures gracefully

---

**Lưu ý**: Sử dụng prompt này để tạo architecture diagram trong Canva, Draw.io, hoặc bất kỳ công cụ vẽ diagram nào khác. Đảm bảo highlight các điểm quan trọng về microservices, event-driven architecture, và data flow patterns.

