# Kroger Developer Tools

https://developer.kroger.com/manage/apps/view


# App

http://localhost:3000

## App login

Email + password for our local Postgres User table.

- `mrwattz@gmail.com`
- `Wb-MGQzSF7*mFXd`

## Kroger OAuth

Authorize the app to call the Kroger Public API on your behalf (product search, cart writes)                                          
## kroger.com

Your real kroger.com username/password, encrypted at rest, used only by the Playwright worker for coupon clipping 

They're separate because (a) the app is designed for me + family/friends, so each user needs their own login regardless of what Kroger account they connect, and (b) we never want a Kroger token or password as your only credential — if Kroger rotates anything, you can still log into the app and re-link. 

## Logs

Run `pnpm stack:logs`



Tillamook Sharp Cheddar Block Cheese

Tillamook Sharp Cheddar Block Cheese 32oz