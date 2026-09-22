# Remote / monorepo home

Mac Agent lives **inside** [`iamadi11/mcp-ui-poc`](https://github.com/iamadi11/mcp-ui-poc) at `mac-agent/`.

It is **not** a separate GitHub repository. Push via the monorepo:

```bash
cd /path/to/mcp-ui-poc
git push origin HEAD
```

Run the Director from the monorepo root:

```bash
npm run autonomous -- start --goal "Build the local-first Mac AI control application." --ticks 12
```
