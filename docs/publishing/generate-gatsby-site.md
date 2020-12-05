# Generate a site using Gatsby

You can use [foam-gatsby-template](https://github.com/mathieudutour/foam-gatsby-template) to generate a static site to host it online on Github or [Vercel](https://vercel.com).

## Publishing your foam to GitHub pages
It comes configured with Github actions to auto deploy to Github pages when changes are pushed to your main branch.

## Publishing your foam to Vercel

When you're ready to publish, run a local build.
```bash
cd _layouts
npm run build
```

Remove `public` from your .gitignore file then commit and push your public folder in `_layouts` to Github.

Log into your Vercel account. (Create one if you don't have it already.)

Import your project. Select `_layouts/public` as your root directory and click **Continue**. Then name your project and click **Deploy**.

That's it!


