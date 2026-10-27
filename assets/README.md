# App assets

## App icon / logo

Add the IronLog logo here:

- `icon.png` — 1024×1024, no transparency (iOS + the base app icon)
- `adaptive-icon.png` — 1024×1024 foreground art in the centre ~66% safe zone,
  transparent background (Android adaptive icon)

Then wire it into `app.json` under `expo` (the `backgroundColor` values already
exist — this adds the image paths):

    {
      "expo": {
        "icon": "./assets/icon.png",
        "android": {
          "adaptiveIcon": {
            "foregroundImage": "./assets/adaptive-icon.png",
            "backgroundColor": "#0a0a0a"
          }
        }
      }
    }

This snippet is intentionally **not** applied to `app.json` yet, because pointing
`expo` at a missing image makes `expo start` fail. Add the two PNGs, then apply it
(or ask and it can be wired in for you).
