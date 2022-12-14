### Parser Combinators library in TypeScript
:)
coded live at [cdecompilador twitch](https://www.twitch.tv/cdecompilador)

### Examples

**Simple usage example**
```ts
new Pair(new Match("Hello"), new Item()).map(_ => ":)").parse("Hello World")
/*
  This generates:
  {
    state: Result.Ok,
    remainder: "World",
    value: ":)"
  }
*/
```

**Contains simple Json parser implemented with the library as proof of concept**
```ts
new JsonObject().parse("{'hello': 'world'}")
/*
  This parses JSON and returns a JavaScript object, equivalent to `JSON.parse` :D 
*/
``` 