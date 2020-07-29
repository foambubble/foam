# Pre-defined User Snippets

Having pre-defined user snippets would enable us to introduce Roam style commands to Foam. Consider the below snippets:

```json
{
  "Zettelkasten Id": {
    "scope": "markdown",
    "prefix": "/id",
    "description": "Zettelkasten Id",
    "body": [
      "${CURRENT_YEAR}-${CURRENT_MONTH}-${CURRENT_DATE} ${CURRENT_HOUR}:${CURRENT_MINUTE}:${CURRENT_SECOND}"
    ]
  },
  "Current date": {
    "scope": "markdown",
    "prefix": "/date",
    "description": "Current date",
    "body": [
      "${CURRENT_YEAR}-${CURRENT_MONTH}-${CURRENT_DATE} ${CURRENT_HOUR}:${CURRENT_MINUTE}:${CURRENT_SECOND}"
    ]
  }
}
```

Which would look like:
![GIF demonstrating User Snippets](./assets/images/snippets.gif)

Using snippets enables Foam users to add custom snippets themselves so they live alongside the first-class `/commands`.
