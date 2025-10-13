# @ibanking/shared

Shared modules package for iBanking microservices.

## Installation

This package is used internally by other services in the iBanking ecosystem. No separate installation is required.

## Usage

### Import Guards
```typescript
import { AccessTokenGuard, RefreshTokenGuard } from '@ibanking/shared';

@Controller('example')
@UseGuards(AccessTokenGuard)
export class ExampleController {
  // ...
}
```

### Import Auth Module
```typescript
import { AuthModule } from '@ibanking/shared';

@Module({
  imports: [
    AuthModule,
    // other modules...
  ],
})
export class AppModule {}
```

### Import Strategies
```typescript
import { AccessTokenStrategy, RefreshTokenStrategy } from '@ibanking/shared';
```

## Available Exports

- **AuthModule**: Main authentication module
- **AccessTokenGuard**: Guard for protecting routes with access tokens
- **RefreshTokenGuard**: Guard for protecting routes with refresh tokens
- **AccessTokenStrategy**: Passport strategy for access token validation
- **RefreshTokenStrategy**: Passport strategy for refresh token validation

## Development

To build the package:
```bash
npm run build
```

## Configuration

Make sure your service's `tsconfig.json` includes the path mapping:
```json
{
  "compilerOptions": {
    "paths": {
      "@ibanking/shared": ["../shared"],
      "@ibanking/shared/*": ["../shared/*"]
    }
  }
}
```

