# Generate a site using Gatsby

## Using foam-gatsby-template

You can use [foam-gatsby-template](https://github.com/mathieudutour/foam-gatsby-template) to generate a static site to host it online on GitHub or [Vercel](https://vercel.com).

### Publishing your foam to GitHub pages

It comes configured with GitHub actions to auto deploy to GitHub pages when changes are pushed to your main branch.

### Publishing your foam to Vercel

When you're ready to publish, run a local build.

```bash
cd _layouts
npm run build
```

Remove `public` from your .gitignore file then commit and push your public folder in `_layouts` to GitHub.

Log into your Vercel account. (Create one if you don't have it already.)

Import your project. Select `_layouts/public` as your root directory and click **Continue**. Then name your project and click **Deploy**.

That's it!

## Using foam-template-gatsby-kb

You can use another template [foam-template-gatsby-kb](https://github.com/hikerpig/foam-template-gatsby-kb), and host it on [Vercel](https://vercel.com) or [Netlify](https://www.netlify.com/).

## Using foam-template-gatsby-theme-primer-wiki

You can use another template [foam-template-gatsby-theme-primer-wiki](https://github.com/theowenyoung/foam-template-gatsby-theme-primer-wiki), ([Demo](https://demo-wiki.owenyoung.com/)), and host it on Github Pages, [Vercel](https://vercel.com) or [Netlify](https://www.netlify.com/).
