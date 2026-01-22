# User Management API Documentation

**TRAB Case Repository Backend**
**Version**: 1.0.0
**Base URL**: `http://localhost:3000/api/v1`
**Date**: January 22, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
   - [Register User](#1-register-user)
   - [Login](#2-login)
   - [Get All Users](#3-get-all-users)
   - [Get Current User Profile](#4-get-current-user-profile)
   - [Change Password](#5-change-password)
   - [Refresh Token](#6-refresh-token)
   - [Logout](#7-logout)
4. [User Roles](#user-roles)
5. [Error Handling](#error-handling)
6. [Complete Examples](#complete-examples)

---

## Overview

The User Management API provides endpoints for user registration, authentication, and profile management. All endpoints use JSON for request and response bodies.

### Base Information

- **Protocol**: HTTP/HTTPS
- **Content-Type**: `application/json`
- **Authentication**: JWT (JSON Web Token)
- **Token Expiry**:
  - Access Token: 15 minutes
  - Refresh Token: 7 days

---

## Authentication

Most endpoints require authentication using a Bearer token in the Authorization header.

### Authentication Header Format

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### Example

```bash
curl -X GET "http://localhost:3000/api/v1/auth/me" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## API Endpoints

### 1. Register User

Create a new user account.

**Endpoint**: `POST /api/v1/auth/register`
**Authentication**: Not required
**Description**: Registers a new user and returns access/refresh tokens

#### Request Body

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+255712345678",
  "role": "registry"
}
```

#### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `email` | string | Valid email address (unique) |
| `password` | string | Minimum 8 characters, must contain uppercase, lowercase, and number |
| `firstName` | string | User's first name (minimum 2 characters) |
| `lastName` | string | User's last name (minimum 2 characters) |

#### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `phoneNumber` | string | Contact phone number |
| `role` | string | User role: `admin`, `registry`, `deciders`, or `custodian` (defaults to `registry`) |

#### Response (201 Created)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "registry",
    "status": "active"
  }
}
```

#### cURL Example

```bash
curl -X POST "http://localhost:3000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+255712345678",
    "role": "deciders"
  }'
```

#### Error Responses

**409 Conflict** - Email already exists
```json
{
  "message": "User with this email already exists",
  "error": "Conflict",
  "statusCode": 409
}
```

**400 Bad Request** - Validation error
```json
{
  "message": ["email must be a valid email"],
  "error": "Bad Request",
  "statusCode": 400
}
```

**400 Bad Request** - Invalid role
```json
{
  "message": ["Role must be one of: admin, registry, deciders, custodian"],
  "error": "Bad Request",
  "statusCode": 400
}
```

---

### 2. Login

Authenticate user and receive access tokens.

**Endpoint**: `POST /api/v1/auth/login`
**Authentication**: Not required
**Description**: Authenticates user credentials and returns tokens

#### Request Body

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

#### Response (200 OK)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJyb2xlIjoicmVnaXN0cnkiLCJpYXQiOjE3NjkwNzE4NTYsImV4cCI6MTc2OTA3Mjc1Nn0.XYZ...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJyb2xlIjoicmVnaXN0cnkiLCJpYXQiOjE3NjkwNzE4NTYsImV4cCI6MTc2OTY3NjU1Nn0.ABC...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "registry",
    "status": "active"
  }
}
```

#### cURL Example

```bash
curl -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePass123!"
  }'
```

#### Saving Token for Future Requests

**Linux/macOS**:
```bash
# Login and save token
TOKEN=$(curl -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"john.doe@example.com","password":"SecurePass123!"}' \
  2>/dev/null | jq -r '.accessToken')

# Use token in subsequent requests
curl -X GET "http://localhost:3000/api/v1/auth/me" \
  -H "Authorization: Bearer $TOKEN"
```

**Windows PowerShell**:
```powershell
# Login and save token
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"john.doe@example.com","password":"SecurePass123!"}'

$token = $response.accessToken

# Use token in subsequent requests
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/me" `
  -Method Get `
  -Headers @{"Authorization"="Bearer $token"}
```

#### Error Responses

**401 Unauthorized** - Invalid credentials
```json
{
  "message": "Invalid email or password",
  "error": "Unauthorized",
  "statusCode": 401
}
```

**401 Unauthorized** - Account locked
```json
{
  "message": "Account is locked. Please try again in 25 minutes.",
  "error": "Unauthorized",
  "statusCode": 401
}
```

**401 Unauthorized** - Account inactive
```json
{
  "message": "Account is not active",
  "error": "Unauthorized",
  "statusCode": 401
}
```

---

### 3. Get All Users

Retrieve list of all registered users.

**Endpoint**: `GET /api/v1/auth/users`
**Authentication**: Required
**Description**: Returns a list of all users (admin functionality)

#### Request Headers

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

#### Response (200 OK)

```json
[
  {
    "id": "0ce06f5c-cd31-4622-a5b4-736c9b7ef434",
    "firstName": "System",
    "lastName": "Administrator",
    "email": "admin@trab.go.tz",
    "role": "public",
    "status": "active",
    "phoneNumber": null,
    "organization": null,
    "tinNumber": null,
    "licenseNumber": null,
    "emailVerified": false,
    "lastLoginAt": null,
    "createdAt": "2026-01-21T18:24:11.753Z",
    "updatedAt": "2026-01-22T08:47:32.462Z"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "role": "deciders",
    "status": "active",
    "phoneNumber": "+255712345678",
    "organization": "ABC Law Firm",
    "tinNumber": "123-456-789",
    "licenseNumber": "LAW-2024-001",
    "emailVerified": true,
    "lastLoginAt": "2026-01-22T10:30:00.000Z",
    "createdAt": "2026-01-22T08:00:00.000Z",
    "updatedAt": "2026-01-22T10:30:00.000Z"
  }
]
```

#### cURL Example

```bash
# Step 1: Login and get token
TOKEN=$(curl -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@trab.go.tz","password":"admin123"}' \
  2>/dev/null | jq -r '.accessToken')

# Step 2: Get all users
curl -X GET "http://localhost:3000/api/v1/auth/users" \
  -H "Authorization: Bearer $TOKEN"
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique user identifier |
| `firstName` | string | User's first name |
| `lastName` | string | User's last name |
| `email` | string | User's email address |
| `role` | string | User role (admin, registry, deciders, custodian) |
| `status` | string | Account status (active, inactive, suspended) |
| `phoneNumber` | string/null | Contact phone number |
| `organization` | string/null | Company/organization |
| `tinNumber` | string/null | Tax ID |
| `licenseNumber` | string/null | Professional license |
| `emailVerified` | boolean | Email verification status |
| `lastLoginAt` | datetime/null | Last login timestamp |
| `createdAt` | datetime | Account creation timestamp |
| `updatedAt` | datetime | Last update timestamp |

#### Security Note

**Excluded Fields** (for security):
- `password` - Never returned in API responses
- `passwordResetToken` - Internal use only
- `emailVerificationToken` - Internal use only
- `loginAttempts` - Internal security metric
- `lockedUntil` - Internal security metric

#### Error Responses

**401 Unauthorized** - Invalid or expired token
```json
{
  "message": "Unauthorized",
  "statusCode": 401
}
```

---

### 4. Get Current User Profile

Retrieve the profile of the currently authenticated user.

**Endpoint**: `GET /api/v1/auth/me`
**Authentication**: Required
**Description**: Returns the profile of the logged-in user

#### Request Headers

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

#### Response (200 OK)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "role": "public",
  "status": "active",
  "phoneNumber": "+255712345678",
  "organization": "ABC Law Firm",
  "tinNumber": "123-456-789",
  "licenseNumber": "LAW-2024-001",
  "emailVerified": false,
  "lastLoginAt": "2026-01-22T10:30:00.000Z",
  "createdAt": "2026-01-22T08:00:00.000Z",
  "updatedAt": "2026-01-22T10:30:00.000Z"
}
```

#### cURL Example

```bash
curl -X GET "http://localhost:3000/api/v1/auth/me" \
  -H "Authorization: Bearer $TOKEN"
```

---

### 5. Change Password

Change the password for the authenticated user.

**Endpoint**: `POST /api/v1/auth/change-password`
**Authentication**: Required
**Description**: Updates user password

#### Request Headers

```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

#### Request Body

```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePassword456!"
}
```

#### Response (200 OK)

```json
{
  "message": "Password changed successfully"
}
```

#### cURL Example

```bash
curl -X POST "http://localhost:3000/api/v1/auth/change-password" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldPassword123!",
    "newPassword": "NewSecurePassword456!"
  }'
```

#### Error Responses

**400 Bad Request** - Current password incorrect
```json
{
  "message": "Current password is incorrect",
  "error": "Bad Request",
  "statusCode": 400
}
```

**400 Bad Request** - Same password
```json
{
  "message": "New password must be different from current password",
  "error": "Bad Request",
  "statusCode": 400
}
```

---

### 6. Refresh Token

Refresh an expired access token using a refresh token.

**Endpoint**: `POST /api/v1/auth/refresh`
**Authentication**: Not required (uses refresh token)
**Description**: Generates new access and refresh tokens

#### Request Body

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Response (200 OK)

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### cURL Example

```bash
curl -X POST "http://localhost:3000/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

#### Error Responses

**401 Unauthorized** - Invalid refresh token
```json
{
  "message": "Invalid refresh token",
  "error": "Unauthorized",
  "statusCode": 401
}
```

---

### 7. Logout

Logout the current user (client-side token deletion).

**Endpoint**: `POST /api/v1/auth/logout`
**Authentication**: Required
**Description**: Signals logout (client must discard tokens)

#### Request Headers

```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

#### Response (200 OK)

```json
{
  "message": "Successfully logged out. Please discard your tokens."
}
```

#### cURL Example

```bash
curl -X POST "http://localhost:3000/api/v1/auth/logout" \
  -H "Authorization: Bearer $TOKEN"
```

**Note**: The server returns a success message, but JWT tokens are stateless. The client application must delete/discard the tokens locally.

---

## User Roles

The system supports four user roles:

| Role | Value | Description |
|------|-------|-------------|
| **Admin** | `admin` | Full system access and administration |
| **Registry** | `registry` | Registry staff with case registration permissions (default) |
| **Deciders** | `deciders` | Board members and decision makers |
| **Custodian** | `custodian` | Document and records custodian |

### Default Role

New users are assigned the `registry` role by default during registration if no role is specified.

### Setting Role During Registration

You can optionally specify a user's role during registration by including the `role` field in the registration request:

```json
{
  "email": "admin@example.com",
  "password": "SecurePass123!",
  "firstName": "Jane",
  "lastName": "Admin",
  "role": "admin"
}
```

If the `role` field is omitted, the user will be assigned the default `registry` role.

---

## Error Handling

### Standard Error Response Format

```json
{
  "message": "Error description",
  "error": "Error type",
  "statusCode": 400
}
```

### Common HTTP Status Codes

| Code | Description | Example |
|------|-------------|---------|
| `200` | Success | Login successful |
| `201` | Created | User registered |
| `400` | Bad Request | Invalid input data |
| `401` | Unauthorized | Invalid credentials or token |
| `409` | Conflict | Email already exists |
| `500` | Server Error | Internal server error |

---

## Complete Examples

### Example 1: Complete Registration Flow

```bash
#!/bin/bash

# 1. Register a new user
echo "Registering new user..."
REGISTER_RESPONSE=$(curl -X POST "http://localhost:3000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane.smith@lawfirm.com",
    "password": "SecurePass2024!",
    "firstName": "Jane",
    "lastName": "Smith",
    "phoneNumber": "+255787654321",
    "organization": "Smith & Associates",
    "licenseNumber": "LAW-TZ-2024-045"
  }' 2>/dev/null)

echo "$REGISTER_RESPONSE" | jq '.'

# Extract access token
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.accessToken')

echo -e "\n✓ Registration successful!"
echo "Access Token: $TOKEN"

# 2. Get user profile
echo -e "\n\nFetching user profile..."
curl -X GET "http://localhost:3000/api/v1/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

### Example 2: Login and List All Users

```bash
#!/bin/bash

# 1. Login
echo "Logging in..."
LOGIN_RESPONSE=$(curl -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@trab.go.tz",
    "password": "admin123"
  }' 2>/dev/null)

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')

echo "✓ Login successful!"
echo "Token: ${TOKEN:0:50}..."

# 2. Get all users
echo -e "\n\nFetching all users..."
curl -X GET "http://localhost:3000/api/v1/auth/users" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

### Example 3: Token Refresh Flow

```bash
#!/bin/bash

# 1. Login and save both tokens
echo "Logging in..."
LOGIN_RESPONSE=$(curl -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!"
  }' 2>/dev/null)

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.refreshToken')

echo "✓ Logged in successfully"

# 2. Use access token to get profile
echo -e "\n\nFetching profile with access token..."
curl -X GET "http://localhost:3000/api/v1/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# 3. Wait for access token to expire (or simulate expiry)
echo -e "\n\nAccess token expired (simulated)..."
echo "Refreshing tokens..."

# 4. Use refresh token to get new tokens
REFRESH_RESPONSE=$(curl -X POST "http://localhost:3000/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}" 2>/dev/null)

NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.accessToken')

echo "✓ Tokens refreshed successfully"

# 5. Use new access token
echo -e "\n\nFetching profile with new access token..."
curl -X GET "http://localhost:3000/api/v1/auth/me" \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN" | jq '.'
```

---

### Example 4: Change Password Flow

```bash
#!/bin/bash

# 1. Login
TOKEN=$(curl -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"OldPassword123!"}' \
  2>/dev/null | jq -r '.accessToken')

echo "✓ Logged in"

# 2. Change password
echo -e "\nChanging password..."
curl -X POST "http://localhost:3000/api/v1/auth/change-password" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldPassword123!",
    "newPassword": "NewSecurePass456!"
  }' | jq '.'

echo -e "\n✓ Password changed successfully"

# 3. Logout
echo -e "\nLogging out..."
curl -X POST "http://localhost:3000/api/v1/auth/logout" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 4. Login with new password
echo -e "\nLogging in with new password..."
NEW_TOKEN=$(curl -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"NewSecurePass456!"}' \
  2>/dev/null | jq -r '.accessToken')

echo "✓ Login successful with new password"
```

---

### Example 5: Using Tokens with JavaScript (Node.js)

```javascript
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';

class TRABAuthClient {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
  }

  // Register a new user
  async register(userData) {
    try {
      const response = await axios.post(`${BASE_URL}/auth/register`, userData);
      this.accessToken = response.data.accessToken;
      this.refreshToken = response.data.refreshToken;
      return response.data;
    } catch (error) {
      throw error.response.data;
    }
  }

  // Login
  async login(email, password) {
    try {
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email,
        password
      });
      this.accessToken = response.data.accessToken;
      this.refreshToken = response.data.refreshToken;
      return response.data;
    } catch (error) {
      throw error.response.data;
    }
  }

  // Get all users
  async getAllUsers() {
    try {
      const response = await axios.get(`${BASE_URL}/auth/users`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      return response.data;
    } catch (error) {
      throw error.response.data;
    }
  }

  // Get current user profile
  async getProfile() {
    try {
      const response = await axios.get(`${BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      return response.data;
    } catch (error) {
      throw error.response.data;
    }
  }

  // Refresh tokens
  async refresh() {
    try {
      const response = await axios.post(`${BASE_URL}/auth/refresh`, {
        refreshToken: this.refreshToken
      });
      this.accessToken = response.data.accessToken;
      this.refreshToken = response.data.refreshToken;
      return response.data;
    } catch (error) {
      throw error.response.data;
    }
  }
}

// Usage example
async function main() {
  const client = new TRABAuthClient();

  // Login
  const loginData = await client.login('admin@trab.go.tz', 'admin123');
  console.log('Logged in:', loginData.user);

  // Get all users
  const users = await client.getAllUsers();
  console.log('Total users:', users.length);

  // Get profile
  const profile = await client.getProfile();
  console.log('My profile:', profile);
}

main().catch(console.error);
```

---

### Example 6: Using Tokens with Python

```python
import requests
import json

BASE_URL = 'http://localhost:3000/api/v1'

class TRABAuthClient:
    def __init__(self):
        self.access_token = None
        self.refresh_token = None

    def register(self, user_data):
        """Register a new user"""
        response = requests.post(
            f'{BASE_URL}/auth/register',
            json=user_data
        )
        response.raise_for_status()
        data = response.json()
        self.access_token = data['accessToken']
        self.refresh_token = data['refreshToken']
        return data

    def login(self, email, password):
        """Login and get tokens"""
        response = requests.post(
            f'{BASE_URL}/auth/login',
            json={'email': email, 'password': password}
        )
        response.raise_for_status()
        data = response.json()
        self.access_token = data['accessToken']
        self.refresh_token = data['refreshToken']
        return data

    def get_all_users(self):
        """Get all users"""
        response = requests.get(
            f'{BASE_URL}/auth/users',
            headers={'Authorization': f'Bearer {self.access_token}'}
        )
        response.raise_for_status()
        return response.json()

    def get_profile(self):
        """Get current user profile"""
        response = requests.get(
            f'{BASE_URL}/auth/me',
            headers={'Authorization': f'Bearer {self.access_token}'}
        )
        response.raise_for_status()
        return response.json()

    def refresh(self):
        """Refresh access token"""
        response = requests.post(
            f'{BASE_URL}/auth/refresh',
            json={'refreshToken': self.refresh_token}
        )
        response.raise_for_status()
        data = response.json()
        self.access_token = data['accessToken']
        self.refresh_token = data['refreshToken']
        return data

# Usage example
if __name__ == '__main__':
    client = TRABAuthClient()

    # Login
    login_data = client.login('admin@trab.go.tz', 'admin123')
    print(f"Logged in: {login_data['user']}")

    # Get all users
    users = client.get_all_users()
    print(f"Total users: {len(users)}")

    # Get profile
    profile = client.get_profile()
    print(f"My profile: {profile}")
```

---

## Testing with Postman

### Setting Up Postman Collection

1. **Create a new collection** named "TRAB User Management"

2. **Add Environment Variables**:
   - `base_url`: `http://localhost:3000/api/v1`
   - `access_token`: (will be set automatically)
   - `refresh_token`: (will be set automatically)

3. **Create Requests**:

#### A. Register User
- **Method**: POST
- **URL**: `{{base_url}}/auth/register`
- **Body** (raw JSON):
```json
{
  "email": "test@example.com",
  "password": "Test123!",
  "firstName": "Test",
  "lastName": "User"
}
```
- **Tests** (to save tokens):
```javascript
pm.environment.set("access_token", pm.response.json().accessToken);
pm.environment.set("refresh_token", pm.response.json().refreshToken);
```

#### B. Login
- **Method**: POST
- **URL**: `{{base_url}}/auth/login`
- **Body** (raw JSON):
```json
{
  "email": "admin@trab.go.tz",
  "password": "admin123"
}
```
- **Tests**:
```javascript
pm.environment.set("access_token", pm.response.json().accessToken);
pm.environment.set("refresh_token", pm.response.json().refreshToken);
```

#### C. Get All Users
- **Method**: GET
- **URL**: `{{base_url}}/auth/users`
- **Headers**:
  - `Authorization`: `Bearer {{access_token}}`

#### D. Get Profile
- **Method**: GET
- **URL**: `{{base_url}}/auth/me`
- **Headers**:
  - `Authorization`: `Bearer {{access_token}}`

---

## Security Best Practices

### For API Consumers

1. **Store Tokens Securely**:
   - Never store tokens in localStorage (vulnerable to XSS)
   - Use httpOnly cookies when possible
   - Consider using secure storage mechanisms

2. **Handle Token Expiry**:
   - Implement automatic token refresh
   - Handle 401 responses gracefully
   - Re-authenticate when refresh token expires

3. **Protect Sensitive Data**:
   - Use HTTPS in production
   - Never log tokens or passwords
   - Implement proper error handling

4. **Password Requirements**:
   - Minimum 8 characters
   - Use strong passwords with mixed case, numbers, and symbols

### Example: Token Refresh Handler

```javascript
// Axios interceptor for automatic token refresh
axios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = getRefreshToken(); // Your storage method
        const response = await axios.post('/api/v1/auth/refresh', {
          refreshToken
        });

        const { accessToken } = response.data;
        setAccessToken(accessToken); // Your storage method

        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

---

## Troubleshooting

### Common Issues

#### 1. "Unauthorized" when using token

**Problem**: 401 Unauthorized error
**Solutions**:
- Check if token is expired (15 min for access token)
- Verify token format in Authorization header
- Ensure token doesn't have extra spaces or newlines
- Try refreshing the token

#### 2. "Invalid email or password"

**Problem**: Login fails
**Solutions**:
- Verify email and password are correct
- Check if account is locked (5 failed attempts = 30 min lock)
- Ensure account status is "active"

#### 3. Cannot see other users

**Problem**: GET /auth/users returns empty or single user
**Solutions**:
- Ensure you're authenticated
- Check that users exist in database
- Verify JWT token is valid

---

## API Changelog

### Version 1.0.0 (January 22, 2026)

- ✅ Initial release
- ✅ User registration endpoint
- ✅ User login with JWT
- ✅ Get all users endpoint
- ✅ Get user profile endpoint
- ✅ Change password endpoint
- ✅ Token refresh endpoint
- ✅ Logout endpoint
- ✅ Password hashing with bcrypt
- ✅ Account locking after failed attempts
- ✅ ClassSerializer for sensitive field exclusion

---

## Support

For issues or questions:

1. Check this documentation
2. Review error messages carefully
3. Check server logs: `tail -f /tmp/trab-server.log`
4. Verify database connectivity
5. Test with cURL examples provided

---

**Documentation Last Updated**: January 22, 2026
**API Version**: 1.0.0
**Server**: http://localhost:3000
