# Achieving Greater Privacy and Security

Foam, at its heart and committed to in its [Principles](https://foambubble.github.io/foam/principles), allows the user to control their content in a flexible and non-prescriptive manner.  This extends to user preferences, or requirements depending on application and context, around both privacy and security.  One way that these use cases can be met is through the use of open-source and not-for-profit mechanisms in the user's workflow to provide a functional equivalence.

## The not very Open Source IDE

Foam is built upon VS Code, itself a Microsoft product built on top of an open source project, but as can be found [here](https://github.com/Microsoft/vscode/issues/60#issuecomment-161792005) the VS Code product itself is not open source.  This means that its inner workings are not transparent, facilitating the collection and distribution of your data, as specified in its [Privacy Statement](https://devblogs.microsoft.com/visualstudio/privacy/).  

This may make you feel uncomfortable, but isn't a reason to consider that Foam isn't the right tool for you as VS Code is built on top of an open source project and one that has resulted in an open source derivative of the same called [VSCodium](https://github.com/VSCodium).  In its own introduction it is described as, "Binary releases of VS Code without MS branding/telemetry/licensing".  Installation packages are easily available for those not wishing to build the application from source code across Windows, Unix and Linux operating systems and access to the VS Code marketplace of add-ons remains in place.

The change you will notice in using VS Code versus VS Codium - simply speaking, none. It is, in just about every way you will think of, the same IDE, just without the Microsoft proprietary licence and telemetry.  Your Foam experience will remain as smooth and productive as before the change.

## Version Control and Replication

In Foam's [Getting Started](https://foambubble.github.io/foam/#getting-started) section, the set up describes how to set up your notes with a GitHub repository in using the template provided.  Doing so provides the user with both the ability to see commits made and therefore versions of their notes, but also allows the user to work across devices or collaborate effectively with other users.  These are all strong use cases, but the web-hosting of the content and closed-source nature of GitHub, being owned by Microsoft, may present some users with issues.

One alternative approach could be to use GitLab, an open source alternative to GitHub.  Whilst it certainly effectively deals with the issue of transparency, it does also collect usage details and sends your content across the internet.  

A more private approach would manage replication between devices and users with a serverless mechanism like [Syncthing](https://syncthing.net).  Its continuous synchronisation means that changes in files are seen almost instantly and offers the choice of using only local network connections or securely using public relays when a local network connection is unavailable.  This means that having two connected devices online will have them synchronised, but it is worth noting that the continuous synchronisation could result in corruption if two users worked on the same file simultaneously and it doesn't offer the same kind of version control that git does (though versioning support can be found and is described [here](https://docs.syncthing.net/users/versioning.html)).  It is also not advisable to attempt to use a continuous synchronisation tool to sync local git repositories as the risk of corruption on the git files is high (see [here](https://forum.syncthing.net/t/can-syncthing-reliably-sync-local-git-repos-not-github/8404/18)).

If you need the version control and collaboration, but do not want to compromise on your privacy, the best course of action is to host the open source GitLab  server software yourself.  The steps (well described [here](https://www.techrepublic.com/article/how-to-set-up-a-gitlab-server-and-host-your-own-git-repositories/)) are not especially complex by any means and can be used exclusively on the local network, if required, offering a rich experience of "built-in version control, issue tracking, code review, CI/CD, and more", according to its website, [GitLab / GitLab Community Edition · GitLab](https://gitlab.com/rluna-gitlab/gitlab-ce).

## A Debt?

Foam development has relied upon it being built on VS Code with its website and documentation hosted on GitHub.  Despite Foam itself being open source, it would be easy to feel that swapping out such items is ungrateful for Microsoft's (passive) contribution.  It would, however, be equally poor to not accept the varying use cases and requirements of Foam users and reflect how these default choices may not be suitable for all.  In exploring the above, we maintain Foam's place in a broad set of applications with a multitude of interfaces.
