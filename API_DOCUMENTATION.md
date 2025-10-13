# 🏦 TDTU I-Banking System - API Documentation

## 📋 Tổng Quan
Hệ thống I-Banking của TDTU cung cấp các API để quản lý thanh toán học phí, xác thực người dùng và quản lý thông tin sinh viên.

**Base URL**: `http://localhost:4000`

---

## 🔐 Authentication APIs

### 1. Đăng Nhập
**Endpoint**: `POST /auth/signin`

**Request Body**:
```json
{
  "username": "string", // Tên đăng nhập hoặc email
  "password": "string"  // Mật khẩu
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "username": "string",
      "fullName": "string",
      "email": "string",
      "phoneNumber": "string",
      "availableBalance": "string",
      "isActive": true
    }
  }
}
```

**Nghiệp vụ**: Xác thực người dùng và trả về access token để sử dụng cho các API khác.

---

### 2. Đăng Ký
**Endpoint**: `POST /auth/signup`

**Request Body**:
```json
{
  "username": "string",
  "password": "string",
  "email": "string",
  "fullName": "string",
  "phoneNumber": "string"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "fullName": "string",
    "phoneNumber": "string",
    "availableBalance": "0.00",
    "isActive": true
  }
}
```

**Nghiệp vụ**: Tạo tài khoản người dùng mới.

---

### 3. Làm Mới Token
**Endpoint**: `GET /auth/refresh`

**Headers**: 
- Cookie: `refresh_token` (tự động gửi)

**Response**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "username": "string",
      "email": "string",
      "fullName": "string",
      "phoneNumber": "string",
      "availableBalance": "string"
    }
  }
}
```

**Nghiệp vụ**: Làm mới access token khi token hiện tại hết hạn.

---

### 4. Đăng Xuất
**Endpoint**: `POST /auth/logout`

**Headers**: 
- Cookie: `refresh_token` (tự động gửi)

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Logout successful"
  }
}
```

**Nghiệp vụ**: Đăng xuất người dùng và vô hiệu hóa refresh token.

---

### 5. Đăng Xuất Tất Cả Thiết Bị
**Endpoint**: `GET /auth/logout-all`

**Headers**: 
- `Authorization: Bearer <access_token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Logged out from all devices"
  }
}
```

**Nghiệp vụ**: Đăng xuất người dùng khỏi tất cả thiết bị.

---

### 6. Thông Tin Cá Nhân
**Endpoint**: `GET /auth/me`

**Headers**: 
- `Authorization: Bearer <access_token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "fullName": "string",
    "phoneNumber": "string",
    "availableBalance": "string",
    "isActive": true
  }
}
```

**Nghiệp vụ**: Lấy thông tin cá nhân của người dùng hiện tại.

---

## 🎓 Student & Tuition APIs

### 7. Lấy Thông Tin Học Phí Theo Student ID
**Endpoint**: `GET /tuition/:studentId`

**Headers**: 
- `Authorization: Bearer <access_token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "studentId": "string",
    "studentName": "string",
    "amount": "string",
    "isActive": true,
    "createdAt": "2025-10-12T08:39:40.749Z",
    "updatedAt": "2025-10-12T08:39:40.749Z"
  }
}
```

**Nghiệp vụ**: Lấy thông tin học phí của sinh viên cụ thể.

---

### 8. Lấy Danh Sách Tất Cả Học Phí
**Endpoint**: `GET /tuition`

**Headers**: 
- `Authorization: Bearer <access_token>`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "studentId": "string",
      "studentName": "string",
      "amount": "string",
      "isActive": true,
      "createdAt": "2025-10-12T08:39:40.749Z",
      "updatedAt": "2025-10-12T08:39:40.749Z"
    }
  ]
}
```

**Nghiệp vụ**: Lấy danh sách tất cả học phí trong hệ thống.

---

## 💳 Payment APIs

### 9. Tạo Thanh Toán
**Endpoint**: `POST /payments`

**Headers**: 
- `Authorization: Bearer <access_token>`
- `Content-Type: application/json`

**Request Body**:
```json
{
  "studentId": "string",     // Mã sinh viên (VD: "522H0006")
  "tuitionAmount": "string"  // Số tiền học phí (VD: "1500000.00")
}
```

**Response Success**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "sagaId": "saga_5f279b49-03c7-4961-a14c-78991a9407e0_1760262398253",
    "message": "Payment saga completed successfully"
  }
}
```

**Response Error**:
```json
{
  "statusCode": 500,
  "message": "Đã có thanh toán đang chờ xử lý cho studentId 522H0006. Vui lòng đợi thanh toán hiện tại hoàn thành."
}
```

**Nghiệp vụ**: 
- Tạo thanh toán học phí cho sinh viên
- Tự động tạo và gửi OTP qua email
- Kiểm tra số dư tài khoản
- Chặn thanh toán trùng lặp cho cùng studentId

---

### 10. Gửi Lại OTP
**Endpoint**: `POST /payments/resend-otp/:paymentId`

**Headers**: 
- `Authorization: Bearer <access_token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "OTP resent successfully"
  }
}
```

**Nghiệp vụ**: Gửi lại mã OTP cho thanh toán đang chờ xử lý.

---

### 11. Xác Thực OTP
**Endpoint**: `POST /otp/verify`

**Headers**: 
- `Authorization: Bearer <access_token>`
- `Content-Type: application/json`

**Request Body**:
```json
{
  "paymentId": "string", // ID của thanh toán
  "otp": "string"        // Mã OTP 6 chữ số
}
```

**Response Success**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "data": {
      "paymentId": "734c4029-53de-494f-aee3-0f443be80e20",
      "status": "completed",
      "message": "Payment completed successfully"
    }
  }
}
```

**Response Error**:
```json
{
  "statusCode": 400,
  "message": "Invalid OTP"
}
```

**Nghiệp vụ**: 
- Xác thực mã OTP để hoàn tất thanh toán
- Tự động trừ tiền từ tài khoản người dùng
- Cập nhật trạng thái học phí về 0
- Gửi email xác nhận thanh toán thành công

---

### 12. Lấy Thông Tin OTP
**Endpoint**: `GET /otp/info/:paymentId`

**Headers**: 
- `Authorization: Bearer <access_token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "paymentId": "string",
    "otpExpiry": "2025-10-12T10:00:00.000Z",
    "attemptsRemaining": 3,
    "status": "pending"
  }
}
```

**Nghiệp vụ**: Lấy thông tin về OTP (thời gian hết hạn, số lần thử còn lại).

---

## 🏥 Health Check

### 13. Kiểm Tra Trạng Thái Hệ Thống
**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-10-12T09:00:00.000Z",
  "services": {
    "auth": "healthy",
    "payment": "healthy",
    "otp": "healthy",
    "notification": "healthy",
    "tuition": "healthy",
    "users": "healthy"
  }
}
```

**Nghiệp vụ**: Kiểm tra trạng thái hoạt động của tất cả các service.

---

## 🔒 Authentication & Authorization

### Headers Bắt Buộc
Tất cả API (trừ signin, signup, health) đều yêu cầu:
```
Authorization: Bearer <access_token>
```

### Token Management
- **Access Token**: Có thời hạn 1 giờ, dùng cho các API chính
- **Refresh Token**: Lưu trong cookie, có thời hạn 7 ngày
- **Auto Refresh**: Tự động làm mới token khi hết hạn

---

## 📱 Frontend Integration Guide

### 1. Authentication Flow
```javascript
// 1. Đăng nhập
const loginResponse = await fetch('/auth/signin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});

// 2. Lưu token
const { accessToken } = await loginResponse.json();
localStorage.setItem('accessToken', accessToken);

// 3. Sử dụng token cho các API khác
const headers = {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
};
```

### 2. Payment Flow
```javascript
// 1. Tạo thanh toán
const paymentResponse = await fetch('/payments', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    studentId: '522H0006',
    tuitionAmount: '1500000.00'
  })
});

// 2. Nhập OTP
const otpResponse = await fetch('/otp/verify', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    paymentId: 'payment-id',
    otp: '123456'
  })
});
```

### 3. Error Handling
```javascript
try {
  const response = await fetch('/api/endpoint', { headers });
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'API Error');
  }
  
  return data;
} catch (error) {
  console.error('API Error:', error.message);
  // Handle error in UI
}
```

---

## 🚨 Error Codes & Messages

### Common Error Messages
- `"User does not exist"` - Tài khoản không tồn tại
- `"Invalid credentials"` - Thông tin đăng nhập sai
- `"Token invalid, User not found"` - Token không hợp lệ
- `"Đã có thanh toán đang chờ xử lý"` - Có thanh toán khác đang xử lý
- `"Học phí đã được thanh toán"` - Học phí đã được thanh toán trước đó
- `"Insufficient balance"` - Số dư không đủ
- `"Invalid OTP"` - Mã OTP không đúng
- `"OTP đã hết hạn"` - Mã OTP đã hết hạn

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

---

## 📋 Business Rules

### Payment Rules
1. **Concurrent Payment Prevention**: Chỉ cho phép 1 thanh toán cho mỗi studentId tại một thời điểm
2. **Full Payment Only**: Phải thanh toán đủ số tiền học phí, không cho phép thanh toán một phần
3. **OTP Expiry**: OTP có thời hạn 2 phút
4. **Auto Timeout**: Thanh toán tự động hủy sau 2 phút không hoạt động
5. **Multiple Tuition Support**: Cho phép thanh toán học phí mới sau khi đã thanh toán học phí cũ

### Security Rules
1. **Rate Limiting**: Giới hạn số lần gọi API
2. **Token Expiry**: Access token hết hạn sau 1 giờ
3. **Secure Cookies**: Refresh token lưu trong secure cookie
4. **Input Validation**: Tất cả input đều được validate

---

## 🔧 Development Notes

### Environment Variables
```bash
# API Gateway
PORT=4000
NODE_ENV=development

# Services
AUTH_SERVICE_URL=http://auth_service:4001
PAYMENT_SERVICE_URL=http://payment_service:4007
OTP_SERVICE_URL=http://otp_service:4003
NOTIFICATION_SERVICE_URL=http://notification_service:4004
TUITION_SERVICE_URL=http://tuition_service:4005
USERS_SERVICE_URL=http://users_service:4006
```

### Testing
- Sử dụng Postman hoặc curl để test API
- Kiểm tra logs của các service để debug
- Test với nhiều user cùng lúc để kiểm tra concurrency

---

*Tài liệu này được tạo tự động từ API Gateway. Cập nhật lần cuối: 2025-10-12*

