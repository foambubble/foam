let
  pkgs = import <nixpkgs> {
	config.allowUnfree = true;
	overlays = []; 
  };
in

pkgs.mkShellNoCC {  
  packages = with pkgs; [
    nodejs_21
    typescript
    yarn
    nodePackages_latest.lerna

    #direnv 
    #hacky -> better add to Home Manager configuration. Otherwise you have to trigger the Nix shell manually in the terminal and maybe the vscode extension direnv will work!
    #see https://github.com/nix-community/nix-direnv?tab=readme-ov-file#via-home-manager

    (vscode-with-extensions.override {
        vscodeExtensions = with vscode-extensions; [
          mkhl.direnv
          dbaeumer.vscode-eslint
        ] ++ pkgs.vscode-utils.extensionsFromVscodeMarketplace [
        { 
            name = "vscode-jest";
            version = "6.4.0";
            publisher = "Orta";
            sha256 = "sha256-habF0CaXgQwAZfdtTLAsoie5i5gWrcKEBDEpxvsjlbE=";
        }];
      })
  ];

  NIX_LD_LIBRARY_PATH = with pkgs; lib.makeLibraryPath [
    stdenv.cc.cc
    openssl
    glib
    nss
    nspr
    atk
    dbus
    libdrm
    gtk3
    pango
    cairo
    xorg.libX11
    xorg.libXcomposite
    xorg.libXdamage
    xorg.libXext
    xorg.libXfixes
    xorg.libXrandr
    xorg.libXpm
    mesa
    expat
    xorg.libxcb
    libxkbcommon
    alsa-lib
    libffi
    pcre2
  ];

  NIX_LD = builtins.readFile "${pkgs.stdenv.cc}/nix-support/dynamic-linker";
  #see https://github.com/nix-community/nix-ld?tab=readme-ov-file
}
