# logout

Ends the current session: the access token sent with this request stops working, right away. **Needs a token** (see [Authentication](../README.md#authentication)).

Only this token is ended. Other users, and the same user logged in somewhere else with another token, stay logged in.

[Back to the API index](../README.md)

## Input

None. The session to end is the token in the `Authorization` header.

## Returns

`Boolean!`: always `true` when the logout worked.

## Example

```graphql
mutation {
  logout
}
```

With the header `Authorization: Bearer <accessToken from login>`.

## Response

```json
{
  "data": {
    "logout": true
  }
}
```

After this, any request with the same token gets `AUTH_NOT_AUTHENTICATED`.

## Errors

| Case                                                        | `extensions.code`        | Message |
| ----------------------------------------------------------- | ------------------------ | ------- |
| No token, or an expired or invalid one                      | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |
| The token was already logged out                            | `AUTH_NOT_AUTHENTICATED` | The current user is not authorized to access this resource. |

## Notes

- A JWT can't be deleted, so the server remembers logged-out tokens by their id (`jti`) in the `revoked_tokens` table, and rejects them on every request. A row is removed once its token would have expired anyway, so the table stays small.
- The frontend should also forget the token after logging out.
