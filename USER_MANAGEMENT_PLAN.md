# User Management Implementation Plan

## Status: IN PROGRESS

---

## ✅ Completed

### 1. Dependencies Installed
```bash
✅ @nestjs/passport
✅ @nestjs/jwt
✅ passport
✅ passport-jwt
✅ bcrypt
✅ class-validator
✅ class-transformer
✅ @types/passport-jwt
✅ @types/bcrypt
```

### 2. User Entity Created

**File:** `src/modules/users/entities/user.entity.ts`

**User Roles:**
- `ADMIN` - Full system access
- `LAWYER` - Access to case documents and search
- `PUBLIC` - Read-only access to public cases

**User Status:**
- `ACTIVE` - Can log in
- `INACTIVE` - Cannot log in
- `SUSPENDED` - Temporarily blocked

**User Fields:**
- ✅ Basic Info: firstName, lastName, email, password
- ✅ Role & Status: role, status
- ✅ Contact: phoneNumber, organization
- ✅ Professional: tinNumber, licenseNumber (for lawyers)
- ✅ Email Verification: emailVerified, emailVerificationToken, emailVerificationExpires
- ✅ Password Reset: passwordResetToken, passwordResetExpires
- ✅ Security: loginAttempts, lockedUntil
- ✅ Tracking: lastLoginAt, createdAt, updatedAt

**Virtual Properties:**
- `fullName` - Combines firstName + lastName
- `isLocked` - Check if account is locked
- `isActive` - Check if account is active and not locked

### 3. Environment Configuration

**File:** `.env`

JWT secrets already configured:
```env
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-change-this
JWT_REFRESH_SECRET=your-refresh-token-secret-key-change-this
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

---

## 📋 TODO: Next Steps

### Phase 1: Auth Module Core (Priority: HIGH)

#### 1.1 Create DTOs

**File:** `src/modules/auth/dto/register.dto.ts`
```typescript
export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  organization?: string;

  @IsOptional()
  @IsString()
  tinNumber?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;
}
```

**File:** `src/modules/auth/dto/login.dto.ts`
```typescript
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

**File:** `src/modules/auth/dto/change-password.dto.ts`
```typescript
export class ChangePasswordDto {
  @IsString()
  oldPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
```

#### 1.2 Create JWT Strategy

**File:** `src/modules/auth/strategies/jwt.strategy.ts`
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
```

#### 1.3 Create Guards

**File:** `src/modules/auth/guards/jwt-auth.guard.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

**File:** `src/modules/auth/guards/roles.guard.ts`
```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.role === role);
  }
}
```

#### 1.4 Create Decorators

**File:** `src/modules/auth/decorators/roles.decorator.ts`
```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
```

**File:** `src/modules/auth/decorators/current-user.decorator.ts`
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

#### 1.5 Create Auth Service

**File:** `src/modules/auth/auth.service.ts`

**Methods to implement:**
- `register(registerDto)` - Create new user
- `login(loginDto)` - Authenticate user and return JWT
- `validateUser(email, password)` - Validate credentials
- `generateTokens(user)` - Generate access + refresh tokens
- `refreshToken(refreshToken)` - Refresh access token
- `changePassword(userId, changePasswordDto)` - Change user password
- `requestPasswordReset(email)` - Send password reset email
- `resetPassword(token, newPassword)` - Reset password with token
- `verifyEmail(token)` - Verify email with token

**Key implementations:**
```typescript
// Password hashing
async hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Password validation
async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Login attempt tracking
async handleFailedLogin(user: User): Promise<void> {
  user.loginAttempts += 1;

  if (user.loginAttempts >= 5) {
    user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }

  await this.userRepository.save(user);
}
```

#### 1.6 Create Auth Controller

**File:** `src/modules/auth/auth.controller.ts`

**Endpoints:**
```typescript
POST   /auth/register           - Register new user
POST   /auth/login              - Login and get JWT tokens
POST   /auth/logout             - Logout (clear tokens)
POST   /auth/refresh            - Refresh access token
POST   /auth/change-password    - Change password (authenticated)
POST   /auth/forgot-password    - Request password reset
POST   /auth/reset-password     - Reset password with token
POST   /auth/verify-email       - Verify email with token
GET    /auth/me                 - Get current user profile
```

#### 1.7 Create Auth Module

**File:** `src/modules/auth/auth.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

---

### Phase 2: Users CRUD Module (Priority: MEDIUM)

#### 2.1 Create DTOs

**File:** `src/modules/users/dto/create-user.dto.ts`
**File:** `src/modules/users/dto/update-user.dto.ts`
**File:** `src/modules/users/dto/user-response.dto.ts`

#### 2.2 Create Users Service

**File:** `src/modules/users/users.service.ts`

**Methods:**
- `findAll(filters, pagination)` - List all users with filters
- `findOne(id)` - Get user by ID
- `findByEmail(email)` - Get user by email
- `create(createUserDto)` - Create new user (admin only)
- `update(id, updateUserDto)` - Update user
- `remove(id)` - Soft delete user
- `updateStatus(id, status)` - Change user status
- `updateRole(id, role)` - Change user role (admin only)

#### 2.3 Create Users Controller

**File:** `src/modules/users/users.controller.ts`

**Endpoints:**
```typescript
GET    /users                  - List all users (admin only)
GET    /users/:id              - Get user by ID
POST   /users                  - Create user (admin only)
PATCH  /users/:id              - Update user
DELETE /users/:id              - Delete user (admin only)
PATCH  /users/:id/status       - Update user status (admin only)
PATCH  /users/:id/role         - Update user role (admin only)
```

#### 2.4 Create Users Module

**File:** `src/modules/users/users.module.ts`

---

### Phase 3: Update App Module

**File:** `src/app.module.ts`

Add to imports:
```typescript
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';

imports: [
  // ... existing modules
  AuthModule,
  UsersModule,
]
```

---

### Phase 4: Database Migration

Run to create users table:
```bash
npm run build
# Restart application - TypeORM will auto-create users table
```

Or create migration:
```bash
npm run typeorm migration:create -- -n CreateUsersTable
```

---

### Phase 5: Testing

#### 5.1 Test Registration
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@trab.go.tz",
    "password": "SecurePass123!",
    "firstName": "Admin",
    "lastName": "User"
  }'
```

#### 5.2 Test Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@trab.go.tz",
    "password": "SecurePass123!"
  }'
```

#### 5.3 Test Protected Endpoint
```bash
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Security Features to Implement

1. ✅ Password hashing with bcrypt (10 rounds)
2. ✅ JWT tokens with expiration
3. ✅ Refresh tokens for extended sessions
4. ✅ Account locking after 5 failed attempts (30 min lockout)
5. ✅ Email verification
6. ✅ Password reset via email
7. ⏳ Rate limiting on auth endpoints
8. ⏳ CORS configuration
9. ⏳ Helmet security headers
10. ⏳ Input validation and sanitization

---

## API Endpoints Summary

### Public Endpoints (No Authentication Required)
```
POST /auth/register
POST /auth/login
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/verify-email
```

### Protected Endpoints (JWT Required)
```
GET  /auth/me
POST /auth/logout
POST /auth/refresh
POST /auth/change-password
```

### Admin-Only Endpoints
```
GET    /users
POST   /users
DELETE /users/:id
PATCH  /users/:id/status
PATCH  /users/:id/role
```

---

## User Roles & Permissions

### ADMIN
- Full system access
- Manage users (create, update, delete)
- Change user roles and status
- Access all cases
- Manage system settings

### LAWYER
- Search all cases
- Access case documents
- Download case files
- View case metadata
- Update own profile

### PUBLIC
- Search public cases only
- View public case metadata
- Limited document access
- Read-only access

---

## Next Implementation Steps (Priority Order)

1. **Create Auth DTOs** (15 min)
2. **Create JWT Strategy** (10 min)
3. **Create Auth Guards** (10 min)
4. **Create Auth Decorators** (5 min)
5. **Implement Auth Service** (30 min)
6. **Implement Auth Controller** (20 min)
7. **Create Auth Module** (5 min)
8. **Test Authentication** (15 min)
9. **Implement Users Service** (20 min)
10. **Implement Users Controller** (15 min)
11. **Create Users Module** (5 min)
12. **Update App Module** (5 min)
13. **Test Complete System** (15 min)

**Total Estimated Time:** ~2.5 hours

---

## Files Structure

```
src/
├── modules/
│   ├── auth/
│   │   ├── dto/
│   │   │   ├── register.dto.ts
│   │   │   ├── login.dto.ts
│   │   │   └── change-password.dto.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts
│   │   │   └── current-user.decorator.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   └── auth.module.ts
│   │
│   └── users/
│       ├── entities/
│       │   └── user.entity.ts          ✅ DONE
│       ├── dto/
│       │   ├── create-user.dto.ts
│       │   ├── update-user.dto.ts
│       │   └── user-response.dto.ts
│       ├── users.service.ts
│       ├── users.controller.ts
│       └── users.module.ts
```

---

**Status:** User entity created ✅
**Next Step:** Implement Auth DTOs and JWT Strategy
**Estimated Time to Completion:** 2.5 hours

