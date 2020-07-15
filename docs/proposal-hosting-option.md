# Proposal: Hosting Option for new users

It would be great if new users could see their content published without having to do anything more than pushing their `.md` files somewhere accessible.

Furthermore, we should do everything possible to minimise the time between a user pushing their code to GitHub (or wherever) and their content being visible, to make the separate hosting as invisible to the process as possible.

## Why

By building a centralised (but still self-hostable) hosting platform that could connect to anybody's Foam repo, we get the following:

* A zero-effort place for less-technical users to have their notes published
* A centralised place for a "standard" set of non-standard React components to be defined/reviewed/published and then accessible with MDX
* A separate collaboration around themes/design/custom components for displaying notes on the web

As long as the code is capable of dynamically fetching & rendering _any_ foam repo, there's actually nothing special about the central copy: anyone can host their own Foam renderer under their own URL, either locked to their own content or open for others to preview with their own data.

By separating the publication ideas from the content ideas (and making them interoperable) I think we'd end up with much more cool ideas/experimentation than tying them together.

## Ideal architecture

* A user on GitHub (`<username>`) creates a public Foam repo name `foam-notes` (or something standardised)
* The URL `<username>.foam.website` (or something similar) is immediately available as a public view of their notes.
* Behind the scenes, by visiting a new username, the metadata for building up backlinks etc is built up in the background.
* Once the site has been crawled & cached, performance should be indistinguishable from self-hosted static files.
* Content changes are propagated within seconds with clever background fetching & caching

For non-GitHub users, it would be easy to set up the same sort of behaviour under a URL scheme `<gitlab-username>.gitlab.foam.website`.

## How

I could give a technical pitch for why I want to build it this way, but the truth is: I want to build it as a tech demo/showcase of what [FABs](https://fab.dev) can do running on an edge, using [Cloudflare Workers](https://workers.dev), deployed using [Linc](https://linc.sh). So, my proposal:

* NextJS in server-rendered mode
* Hosted in a FAB in Cloudflare Workers
* Using the [KV store](https://developers.cloudflare.com/workers/reference/storage) as a global cache for metadata/rendered documents.

For the first request for any new URL:

* Fetch the raw markdown from GitHub directly
* Store it in the Cache
* Return rendered page

For repo-wide metadata like backlinks, we don't need to slow down the first request, but can set off a crawler process in the background.

Both of these processes lend themselves to a "serve stale" approach:

* The edge renderer _always_ responds with the current version in-cache, so responses are always fast (after the very first requests).
* Periodically (ideally, once every ~5-10 seconds) GitHub is checked to see if there have been updates. If there have been, the cache is refreshed and new requests will get the updated content. **This means the time between pushing new content and it being visible could be as low as 5 seconds**.

## Alternatives

This is the way I'd like to build it, but it's not the only approach:

* A static-site generator could be part of the Foam workspace example (as it sorta is now). People can publish using GitHub pages or Netlify (or Linc & Cloudflare, too).
	* ❌ Needs users to register a separate account with another service (assuming GitHub pages isn't sufficient)
	* ✅ A user's repo is wholly self-contained
	* ❌ Having the SSG bundled means it will gradually diverge between users, which might make new features harder for people to adopt, and make it less possible for people to share ideas.
	* ❌ Delay between pushing and publishing isn't great, but isn't bad for simple sites
	* ✅ Hosting is bulletproof and totally portable
* A "real" centralised service could be built
	* ✅ Users could go, Sign Up with GitHub and add a workspace.
	* ✅ All metadata could be pre-generated when a site is added, not lazily
	* ✅ Changes could be synced instantly
	* ❌ A lot more work
	* ❌ Not necessarily promoting of people self-hosting/sharing/experimenting

Anyway, that's my proposal. Feels like a fun thing to work on!

---

For an idea for what a novel layout/display might look like, I was chatting to @superhighfives about building this sort of thing before Foam was announced. This was the latest version of his design (with the Foam docs copy-pasted in):

![image](https://user-images.githubusercontent.com/23264/87569351-e7026080-c6be-11ea-97fb-4508df07c958.png)

I love the idea that anyone could change the URL a little bit and see _their_ content in the same cool layout!
