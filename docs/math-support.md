---
layout: mathjax
---

# Math Support

Published Foam pages don't support math formulas by default. To enable this feature, you can add the following code snippet to the end of `_layouts/page.html`:

```html
<script src="https://cdn.jsdelivr.net/npm/mathjax@2/MathJax.js?config=TeX-AMS-MML_HTMLorMML" type="text/javascript"></script>
<script type="text/x-mathjax-config">
    MathJax.Hub.Config({
        tex2jax: {
            skipTags: ['script', 'noscript', 'style', 'textarea', 'pre'],
            inlineMath: [['$','$']]
        }
    });
</script>
```

This approach uses the [MathJax](https://www.mathjax.org/) library to render anything delimited by ```$``` (customizable in the snippet above) pairs to inline math and ```$$``` to blocks of math (like a html div tag) using with the AMS-LaTeX dialect embedded within MathJax.

Example of inline math using `$...$`:

`$e^{i \pi}+1=0$`, becomes $e^{i \pi}+1=0$

Example of a math block using `$$...$$`:

`$$ f_{\mathbf{X}}\left(x_{1}, \ldots, x_{k}\right)=\frac{\exp \left(-\frac{1}{2}(\mathbf{x}-\boldsymbol{\mu})^{\mathrm{T}} \mathbf{\Sigma}^{-1}(\mathbf{x}-\boldsymbol{\mu})\right)}{\sqrt{(2 \pi)^{k}|\mathbf{\Sigma}|}} $$`

Becomes:

$$ f_{\mathbf{X}}\left(x_{1}, \ldots, x_{k}\right)=\frac{\exp \left(-\frac{1}{2}(\mathbf{x}-\boldsymbol{\mu})^{\mathrm{T}} \mathbf{\Sigma}^{-1}(\mathbf{x}-\boldsymbol{\mu})\right)}{\sqrt{(2 \pi)^{k}|\mathbf{\Sigma}|}} $$

## Alternative approaches

There are other dialects of LaTeX (instead of AMS), and other JavaScript rendering libraries you may want to use. In a future version of Foam, we may support KaTeX syntax out of the box, but at this time, these integrations are left as an exercise to the user.

## Why don't my Math expressions work on my Foam's home page?

If you want the index page of your Foam site to render maths, you'll need to add that to `_layouts/home.html` as well, or change the layout of the index page to be "page" instead of "home" by putting this Front Matter on the top of your `readme.md/index.md`:

```
---
layout: page
---

# Your normal title here
```

Reference: [How to support latex in github-pages](https://stackoverflow.com/questions/26275645/how-to-support-latex-in-github-pages)
