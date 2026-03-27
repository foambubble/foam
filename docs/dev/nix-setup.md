# Nix-Setup

## Goal

This project uses Nix to ensure a fully reproducible development environment.
It aims to make contributing easier, setup simpler, and onboarding much faster.
Once you have Nix installed, simply open the project folder to start coding in the preconfigured environment.

## About Nix (and NixOS)

Nix is a purely functional package manager that builds software environments in a fully reproducible way.
It means every package, dependency, and configuration is described declaratively — like a recipe — and isolated from the rest of your system. The result: if it works on one machine, it will work exactly the same on another.

NixOS is a Linux distribution built on top of Nix. It extends this concept to the entire operating system: everything, from the kernel to user packages, is defined in configuration files.
This makes it possible to rebuild your system or development environment from scratch with a single command — reliable, clean, and reproducible. For more information look at the [official Documentation](https://nixos.org/).

## Benefits

Using Nix in this project comes with several advantages that make contributing smoother and more predictable:

**Reproducible environment** – every contributor uses the exact same versions of tools, libraries, and dependencies.

**Pure Functional Package Management** - Nix handles software environments functional - it´s like mathematics: same inputs -> same outputs

**Declarative Environments** - no manual installation like apt install, you simple describe in one file which tools and versions you need.

**No global setup needed** – all requirements are defined inside the project; you don’t need to install anything manually.

**Fast onboarding** – clone the repo, open the folder, and start coding — everything just works.

**Consistent builds** – the same environment is used locally and in CI, ensuring reliable results.

**Easy updates** – with Nix-setup, you can refresh or rebuild the environment whenever the configuration changes.


## Setup

While this project uses Nix for a reproducible development environment, you can also use NixOS as your operating system for programming tasks. However, it’s not recommended to use it as your main OS for everyday work.

### NixOS in a VM

A practical approach is to install NixOS in a virtual machine (VM) and use VS Code Remote to connect to it. This way:

- your main OS stays stable and unaffected.
- you get a fully configured Nix environment for the project.
- you can start coding and experimenting without worrying about breaking your system.

Once the VM is running, the workflow is simple: open VS Code on your main OS, connect via the Remote - SSH / Remote - WSL extension to the Nix VM, and all project tools are ready.
This way, you have a complete VM that you can use for all your programming projects, with no need to install development tools on your main machine for everyday tasks.

### Installation
To install NixOS you can follow the official installation guide: https://nixos.org/download.html

There are several preconfigured NixOS configurations available online. You can also start with my [personal minimal configuration](https://github.com/Purschke/machines).

It is recommended to install a few essentials globally, so you don’t need to install them for every project:

- VS Code Server – foundation of the development environment, used for almost all projects.
- Git
- Direnv – allows to load the Nix file automaticly when you open your project folder

You can look here for a more detailed description for the nixos setup and [VS Code](https://nixos.wiki/wiki/Visual_Studio_Code) configuration.


### ⚠️ A warning for NixOS and those who want to try using it:
Nix can feel intimidating at first — the syntax looks complex, and the learning curve is steep (probably just my opinion in my little world). So don’t worry, this is completely normal! It took me quite a time - if not even days - to get a working NixOS environment as well. But I’m sure you will be better than me and get it done much faster.

The good news: once your VM is set up and VS Code Remote is connected, the hardest part is over. You now have a fully configured development environment and can start contributing right away — and use it for every project you want, as long as the project supports Nix.

## Quick Start

Once your NixOS VM is set up and VS Code Remote is connected, you can get started with the project in just a few steps:

**1. Clone the repository**

git clone <repository-url>
cd <project-folder>


**2. Open the project folder**

Simply open the folder in VS Code.

All required tools and dependencies will automatically be available through the Nix environment (assuming Direnv is installed and configured).

You can start coding immediately — no extra setup needed. And of course you can use all tools of the projcet like you used it on the os you worked before. So for Example just type ``yarn build`` to build the project.

## Why Nix

I really hated myself when I first started working with Nix. It felt so fancy and complicated — but I also believed in the benefits once it would work.
After failing a thousand times to install a working NixOS configuration and spending countless hours cleaning up my setup, I almost started questioning the power of NixOS because of how much time I had to invest.

Then I started creating the configuration for this project — and Nix hit me again.
But once I finally had my working NixOS setup - it just worked.

Now I can use it for any project I want and never run into dependency issues or missing installations again — at least when working on projects that support Nix.

For me, Nix feels like the right direction for open-source development — it simplifies the process of getting started and contributing to projects.
Once you have your configured Nix enviroment, it’s really just about checking out the repository and getting to work.
No more driver installs, no missing tools, no setup chaos.

Maybe Nix isn’t quite there yet, but I’m sure it will become better and easier to use.

**The effort is worth it!** 🚀

## Known Issues

### yarn test

Error: $DISPLAY not set / GUI-related errors on Windows or SSH

yarn test require a graphical environment and expect the $DISPLAY environment variable to be set for the integration tests.

On Windows (or WSL), this variable is not set by default, which can lead to errors like:

```bash
Error: Cannot open display
```

Solution:

Install and run xvfb (X virtual framebuffer) in your NixOS VM:`

```bash
nix-shell -p xvfb-run
xvfb-run <command>
```

Or, if using a full X server, make sure $DISPLAY points to a running X server.

Official VS Code Remote Issue:

For more details, see the related issue in the VS Code Remote-SSH extension:
[Environment variable $DISPLAY removed when using Remote SSH](https://github.com/microsoft/vscode/issues/216671)

## References
- [Official Nix Website](https://nixos.org/)
- [NixOS configuration templates](https://nixos.wiki/wiki/Configuration_Collection)
- [my personal minimal NixOS config](https://github.com/Purschke/machines)
