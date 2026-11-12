# me

Returns the user the access token belongs to. **Needs a token** (see [Authentication](../README.md#authentication)).

Use it to find out who is logged in, for example to show their email in the header.

[Back to the API index](../README.md)

## Arguments

None. The user comes from the token.

## Returns

A [`User`](../types.md#user).

## Example

```graphql
query {
  me {
    id
    email
  }
}
```

With the header `Authorization: Bearer <accessToken from login>`.

## Response

```json
{
  "data": {
    "me": {
      "id": "01a1ab51-d6a2-7116-99b9-0f0d52de1527",
      "email": "user1@local.test"
    }
  }
}
```

## Errors

| Case                                     | `extensions.code`        | Message |
| ---------------------------------------- | ------------------------ | ------- |
| No token, or an expired or invalid token | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |
| The token's user no longer exists        | `NOT_FOUND`              | User '…' was not found. |
