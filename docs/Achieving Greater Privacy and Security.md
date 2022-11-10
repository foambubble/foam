# Achieving Greater Privacy and Security

Foam, at its heart and committed to in its [Principles](https://foambubble.github.io/foam/principles), allows the user to control their content in a flexible and non-prescriptive manner.  This extends to user preferences, or requirements depending on application and context, around both privacy and security.  One way that these use cases can be met is through the use of open-source and not-for-profit mechanisms in the user's workflow to provide a functional equivalence.

Here are a few suggestions on increasing privacy and security when using Foam.
## VS Codium: The Open Source build of VS Code 

Foam is built upon VS Code, itself a Microsoft product built on top of an open source project.

As can be found [here](https://github.com/Microsoft/vscode/issues/60#issuecomment-161792005) the **VS Code product itself is not fully open source**. This means that its inner workings are not fully transparent, facilitating the collection and distribution of your data, as specified in its [Privacy Statement](https://devblogs.microsoft.com/visualstudio/privacy/).  

If you prefer a fully open source editor based on the same core of VS Code (and for most intents and purposes equivalent to it), you can try [VSCodium](https://github.com/VSCodium).  
In its own introduction it is described as, "Binary releases of VS Code without MS branding/telemetry/licensing".  Installation packages are easily available across Windows, Unix and Linux (or you can build it from source!).
Access to the VS Code marketplace of add-ons remains in place, including the Foam extension.

The change you will notice in using VS Code versus VS Codium - simply speaking, none. It is, in just about every way you will think of, the same IDE, just without the Microsoft proprietary licence and telemetry.  Your Foam experience will remain as smooth and productive as before the change.

## Version Control and Replication

In Foam's [Getting Started](https://foambubble.github.io/foam/#getting-started) section, the set up describes how to set up your notes with a GitHub repository in using the template provided.  Doing so provides the user with the ability to see commits made and therefore versions of their notes, allows the user to work across devices or collaborate effectively with other users, and makes publishing to GitHub pages easy.
It's important at the same time to point out the closed-source nature of GitHub, being owned by Microsoft.

One alternative approach could be to use [GitLab](https://gitlab.com/), an open source alternative to GitHub.  Whilst it improves on the aspect of transparency, it does also collect usage details and sends your content across the internet.  
And of course data is still stored in clear in the cloud, making it susceptible to hacks of the service.

A more private approach would manage replication between devices and users with a serverless mechanism like [Syncthing](https://syncthing.net).  Its continuous synchronisation means that changes in files are seen almost instantly and offers the choice of using only local network connections or securely using public relays when a local network connection is unavailable.  This means that having two connected devices online will have them synchronised, but it is worth noting that the continuous synchronisation could result in corruption if two users worked on the same file simultaneously and it doesn't offer the same kind of version control that git does (though versioning support can be found and is described [here](https://docs.syncthing.net/users/versioning.html)).  It is also not advisable to attempt to use a continuous synchronisation tool to sync local git repositories as the risk of corruption on the git files is high (see [here](https://forum.syncthing.net/t/can-syncthing-reliably-sync-local-git-repos-not-github/8404/18)).

If you need the version control and collaboration, but do not want to compromise on your privacy, the best course of action is to host the open source GitLab  server software yourself.  The steps (well described [here](https://www.techrepublic.com/article/how-to-set-up-a-gitlab-server-and-host-your-own-git-repositories/)) are not especially complex by any means and can be used exclusively on the local network, if required, offering a rich experience of "built-in version control, issue tracking, code review, CI/CD, and more", according to its website, [GitLab / GitLab Community Edition · GitLab](https://gitlab.com/rluna-gitlab/gitlab-ce).

