# Cartoon Studio

A static marketing website for **Cartoon Studio** — custom cartoon portraits,
brand mascots, and illustration.

## Structure

```
index.html      # Landing page
css/styles.css  # Styles
js/main.js      # Site interactions (mobile nav, footer year)
```

## Run locally

No build step or dependencies. Open `index.html` directly, or serve the
folder for accurate relative paths:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Roadmap

Outstanding work is tracked with `TODO` comments in the source:

- Load gallery images dynamically from a data source.
- Validate the contact form and submit it to a backend endpoint.
