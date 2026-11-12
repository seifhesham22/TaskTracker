# register

Creates a user account from an email address and a password. The email becomes the account's user name. Accounts are stored with ASP.NET Core Identity: the password is saved only as a hash, and the response never contains the password or the hash.

[Back to the API index](../README.md)

## Input

| Field      | Type     | Required | Notes |
| ---------- | -------- | -------- | ----- |
| `email`    | `String` | yes      | A valid email address that has no account yet. Spaces around it are removed. Checking for an existing account ignores upper and lower case |
| `password` | `String` | yes      | At least 10 characters, with an uppercase letter, a lowercase letter, a digit and a symbol |

## Returns

A [`User`](../types.md#user).

## Example

```graphql
mutation {
  register(input: { email: "new.user@local.test", password: "Valid@Pass123" }) {
    id
    email
  }
}
```

## Response

```json
{
  "data": {
    "register": {
      "id": "01a1c3e2-5b7d-7a10-9f3e-2b4c6d8e0f12",
      "email": "new.user@local.test"
    }
  }
}
```

## Errors

| Case                                   | `extensions.code` | Message |
| -------------------------------------- | ----------------- | ------- |
| Email is empty or only spaces          | `BAD_USER_INPUT`  | Email is required. |
| Email is not a valid email address     | `BAD_USER_INPUT`  | '…' is not a valid email address. |
| An account with that email exists      | `BAD_USER_INPUT`  | An account with the email '…' already exists. |
| Password breaks one or more rules      | `BAD_USER_INPUT`  | Identity's message for each broken rule, for example "Passwords must be at least 10 characters." |
| `email` or `password` missing          | (none)            | Refused by the schema: the field is required and cannot be null. |

## Notes

- There is no login yet, so `register` doesn't sign the user in.
- To check that the password is stored as a hash: `SELECT "Email", "PasswordHash" FROM "AspNetUsers" WHERE "Email" = 'new.user@local.test';`
