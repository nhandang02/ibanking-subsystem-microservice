# API Gateway Error Handling Improvements

## Vấn đề ban đầu

API Gateway không trả về lỗi chi tiết như các service khác vì:

1. **Mất thông tin chi tiết khi proxy**: Chỉ lấy `error.message` thay vì toàn bộ error object
2. **Không preserve error codes**: Không truyền `errorCode`, `errorType`, hoặc metadata khác
3. **Error handling không nhất quán**: Mỗi method xử lý lỗi khác nhau

## Cải thiện đã thực hiện

### 1. Enhanced Error Response Structure

**Trước:**
```json
{
  "message": "Payment processing failed",
  "statusCode": 400
}
```

**Sau:**
```json
{
  "message": "Đã nhập sai OTP quá 5 lần. Thanh toán đã được hủy tự động.",
  "errorCode": "OTP_MAX_ATTEMPTS",
  "errorType": "ValidationError",
  "details": "Stack trace hoặc thông tin chi tiết",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "payment-service",
  "path": "/payments",
  "method": "POST"
}
```

### 2. Improved AppService Error Handling

**File:** `services/api-gateway/src/app.service.ts`

- **Enhanced error data extraction**: Lấy `errorCode`, `errorType`, `details` từ service response
- **Consistent error structure**: Tất cả lỗi đều có cùng format
- **Service identification**: Thêm `timestamp` và `service` name

### 3. Centralized Error Handling

**File:** `services/api-gateway/src/app.controller.ts`

- **Helper method `handleError()`**: Xử lý lỗi nhất quán cho tất cả methods
- **Error type mapping**: Map error messages thành appropriate HTTP status codes
- **Service-specific error handling**: Mỗi service có error handling riêng

### 4. Enhanced Global Error Handler

**File:** `services/api-gateway/src/main.ts`

- **Preserve detailed error info**: Giữ nguyên error response từ HttpException
- **Add request context**: Thêm `path` và `method` vào error response
- **Consistent error format**: Đảm bảo tất cả lỗi có cùng structure

## Error Types và Codes

### Payment Service Errors
- `OTP_EXPIRED`: OTP đã hết hạn
- `OTP_MAX_ATTEMPTS`: Đã nhập sai OTP quá 5 lần
- `INSUFFICIENT_BALANCE`: Số dư không đủ
- `SAGA_FAILED`: Saga pattern failed

### Auth Service Errors
- `UNAUTHORIZED`: Token không hợp lệ
- `FORBIDDEN`: Không có quyền truy cập
- `USER_NOT_FOUND`: User không tồn tại

### Tuition Service Errors
- `STUDENT_NOT_FOUND`: Student không tồn tại
- `VALIDATION_ERROR`: Dữ liệu không hợp lệ

### General Errors
- `SERVICE_UNAVAILABLE`: Service không khả dụng
- `INTERNAL_ERROR`: Lỗi hệ thống
- `VALIDATION_ERROR`: Lỗi validation
- `NOT_FOUND`: Không tìm thấy resource

## Testing

Sử dụng script `test-error-handling.sh` để test các scenario lỗi:

```bash
./test-error-handling.sh
```

Script sẽ test:
1. Invalid payment data
2. Invalid OTP
3. Non-existent student
4. Invalid authentication

## Kết quả

Bây giờ API Gateway sẽ trả về lỗi chi tiết giống như các service khác:

- ✅ **Error codes**: `OTP_EXPIRED`, `INSUFFICIENT_BALANCE`, etc.
- ✅ **Error types**: `ValidationError`, `AuthError`, `NotFoundError`
- ✅ **Detailed messages**: Thông báo lỗi cụ thể bằng tiếng Việt
- ✅ **Service identification**: Biết lỗi từ service nào
- ✅ **Request context**: Path và method của request
- ✅ **Timestamp**: Thời gian xảy ra lỗi
- ✅ **Stack traces**: Chi tiết lỗi cho debugging

## Ví dụ Response

```json
{
  "message": "Đã nhập sai OTP quá 5 lần. Thanh toán đã được hủy tự động.",
  "errorCode": "OTP_MAX_ATTEMPTS",
  "errorType": "ValidationError",
  "details": "Error stack trace...",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "payment-service",
  "path": "/payments/verify-otp",
  "method": "POST"
}
```


