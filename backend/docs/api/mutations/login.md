# login

Checks an email and password against the registered accounts and returns an access token (a JWT) for that user. Send the token with every request that needs one; see [Authentication](../README.md#authentication).

[Back to the API index](../README.md)

## Input

| Field      | Type     | Required | Notes |
| ---------- | -------- | -------- | ----- |
| `email`    | `String` | yes      | Spaces around it are removed. Upper and lower case don't matter |
| `password` | `String` | yes      | |

## Returns

A [`LoginPayload`](../types.md#loginpayload).

## Example

```graphql
mutation {
  login(input: { email: "user1@local.test", password: "Dev@123456" }) {
    accessToken
    tokenType
    expiresAt
    user {
      id
      email
    }
  }
}
```

## Response

```json
{
  "data": {
    "login": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMWExYWI1MS…",
      "tokenType": "Bearer",
      "expiresAt": "2026-11-12T10:07:44.659Z",
      "user": {
        "id": "01a1ab51-d6a2-7116-99b9-0f0d52de1527",
        "email": "user1@local.test"
      }
    }
  }
}
```

## Errors

| Case                                               | `extensions.code`     | Message |
| -------------------------------------------------- | --------------------- | ------- |
| Email or password is empty                         | `BAD_USER_INPUT`      | Email and password are required. |
| Wrong password, or no account with that email      | `INVALID_CREDENTIALS` | Invalid email or password. |
| Five wrong passwords in a row (account locked for 5 minutes) | `INVALID_CREDENTIALS` | Invalid email or password. |
| `email` or `password` missing                      | (none)                | Refused by the schema: the field is required and cannot be null. |

A wrong password and an unknown email get exactly the same response, so the API never tells anyone whether an email has an account.

## Notes

- The seeded users can log in with password `Dev@123456` (see [Seed data](../../../README.md#seed-data)).
- The token is signed with the `Jwt:Key` setting. Docker sets a development key for you; see [Run](../../../README.md#run).
